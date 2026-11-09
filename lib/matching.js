import { base44 } from '@/api/base44Client';
import { normalizeId, nameSimilarity, generateReferenceCode, maskDocumentNumber } from '@/lib/ldrs';
import { sendOwnerNotification, buildFoundDocumentMessage } from '@/lib/notifications';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';

export const FUZZY_NAME_THRESHOLD = 0.6;

/**
 * Compares a newly registered found document with every open loss report.
 *  - same type + same number        -> Exact match, confirmed, owner notified
 *  - same type + similar owner name -> Fuzzy match, pending, sent to officer review
 */
export async function createMatchesForDocument({ doc, pickupPoint, actor }) {
    const openReports = await base44.entities.LossReport.filter({
        document_type: doc.document_type,
        status: 'Open',
    });

    const created = [];

    for (const report of openReports) {
        const reportNumber = normalizeId(report.document_number);
        const documentNumber = normalizeId(doc.document_number);
        const exact = Boolean(reportNumber) && reportNumber === documentNumber;
        const similarity = nameSimilarity(report.owner_name, doc.owner_name);

        let matchType = null;
        let score = 0;
        if (exact) {
            matchType = 'Exact';
            score = 100;
        } else if (similarity >= FUZZY_NAME_THRESHOLD) {
            matchType = 'Fuzzy';
            score = Math.round(similarity * 100);
        }
        if (!matchType) continue;

        const referenceCode = matchType === 'Exact' ? generateReferenceCode() : null;
        const match = await base44.entities.Match.create({
            document_id: doc.id,
            loss_report_id: report.id,
            owner_user_id: report.owner_user_id,
            match_score: score,
            match_type: matchType,
            match_status: matchType === 'Exact' ? 'Confirmed' : 'Pending',
            reference_code: referenceCode,
        });

        if (matchType === 'Exact') {
            await sendOwnerNotification({
                userId: report.owner_user_id,
                message: buildFoundDocumentMessage({
                    documentType: doc.document_type,
                    documentNumber: doc.document_number,
                    pickupPointName: pickupPoint ? pickupPoint.name : '',
                    referenceCode,
                }),
            });
            await logAction({
                action: AUDIT_ACTIONS.NOTIFICATION_SENT,
                details: `Exact match alert sent to owner of loss report ${report.id} (${maskDocumentNumber(doc.document_number)})`,
                            user: actor,
            });
        }

        created.push({ match, report, notified: matchType === 'Exact' });
    }

    return created;
}

/**
 * The other direction: when an owner reports a document lost, documents that are already
 * being held are checked straight away, so a document handed in earlier is not missed.
 */
export async function matchLossReportAgainstHeldDocuments({ report, actor }) {
    const held = await base44.entities.Document.filter({
        document_type: report.document_type,
        status: { $in: ['Found', 'Matched'] },
    });
    const items = held.items || held || [];
    if (!items.length) return [];

    const points = await base44.entities.PickupPoint.list();
    const pointMap = {};
    (Array.isArray(points) ? points : []).forEach(function (point) {
        pointMap[point.id] = point;
    });

    const created = [];

    for (const doc of items) {
        const reportNumber = normalizeId(report.document_number);
        const documentNumber = normalizeId(doc.document_number);
        const exact = Boolean(reportNumber) && reportNumber === documentNumber;
        const similarity = nameSimilarity(doc.owner_name, report.owner_name);

        let matchType = null;
        let score = 0;
        if (exact) {
            matchType = 'Exact';
            score = 100;
        } else if (similarity >= FUZZY_NAME_THRESHOLD) {
            matchType = 'Fuzzy';
            score = Math.round(similarity * 100);
        }
        if (!matchType) continue;

        const point = pointMap[doc.pickup_point_id] || null;
        const referenceCode = matchType === 'Exact' ? generateReferenceCode() : null;
        const match = await base44.entities.Match.create({
            document_id: doc.id,
            loss_report_id: report.id,
            owner_user_id: report.owner_user_id,
            match_score: score,
            match_type: matchType,
            match_status: matchType === 'Exact' ? 'Confirmed' : 'Pending',
            reference_code: referenceCode,
        });

        if (matchType === 'Exact') {
            await sendOwnerNotification({
                userId: report.owner_user_id,
                message: buildFoundDocumentMessage({
                    documentType: doc.document_type,
                    documentNumber: doc.document_number,
                    pickupPointName: point ? point.name : '',
                    referenceCode,
                }),
            });
            await logAction({
                action: AUDIT_ACTIONS.NOTIFICATION_SENT,
                details: 'Owner alerted about document already held at ' + (point ? point.name : 'a pickup point'),
                            user: actor,
            });
        }

        created.push({ match, document: doc, pickupPoint: point });
    }

    return created;
}

export async function confirmMatch({ match, document, report, pickupPoint, actor }) {
    const referenceCode = match.reference_code || generateReferenceCode();

    await base44.entities.Match.update(match.id, {
        match_status: 'Confirmed',
        reference_code: referenceCode,
    });
    if (document) await base44.entities.Document.update(document.id, { status: 'Notified' });
    if (report) await base44.entities.LossReport.update(report.id, { status: 'Matched' });

    await sendOwnerNotification({
        userId: report ? report.owner_user_id : match.owner_user_id,
        message: buildFoundDocumentMessage({
            documentType: document ? document.document_type : 'document',
            documentNumber: document ? document.document_number : '',
            pickupPointName: pickupPoint ? pickupPoint.name : '',
            referenceCode,
        }),
    });

    await logAction({
        action: AUDIT_ACTIONS.MATCH_CONFIRMED,
        details: `Fuzzy match ${match.id} confirmed with reference ${referenceCode}`,
        user: actor,
    });
    await logAction({
        action: AUDIT_ACTIONS.NOTIFICATION_SENT,
        details: `Owner notified for confirmed match ${match.id}`,
        user: actor,
    });

    return referenceCode;
}

export async function rejectMatch({ match, document, actor, otherActiveMatches }) {
    await base44.entities.Match.update(match.id, { match_status: 'Rejected' });
    if (document && !otherActiveMatches) {
        await base44.entities.Document.update(document.id, { status: 'Found' });
    }
    await logAction({
        action: AUDIT_ACTIONS.MATCH_REJECTED,
        details: `Match ${match.id} rejected`,
        user: actor,
    });
}
