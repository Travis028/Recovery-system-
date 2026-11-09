import { base44 } from '@/api/base44Client';
import {
    documentTypeLabel,
    generateReferenceCode,
    maskDocumentNumber,
    nameSimilarity,
    normalizeId,
} from '@/lib/ldrs';
import { sendOwnerNotification, buildFoundDocumentMessage } from '@/lib/notifications';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';

/**
 * An officer has verified an owner's claim. A confirmed match is created so the
 * normal collection flow (reference code, collection code, handover) continues.
 */
export async function approveClaim({ claim, document, pickupPoint, actor }) {
    const reportPage = await base44.entities.LossReport.filter(
        {
            owner_user_id: claim.owner_user_id,
            document_type: document.document_type,
            status: { $in: ['Open', 'Matched'] },
        },
        { sort: '-created_date', limit: 1 },
    );

    let report = (reportPage.items || [])[0] || null;
    if (!report) {
        report = await base44.entities.LossReport.create({
            owner_user_id: claim.owner_user_id,
            document_type: document.document_type,
            owner_name: claim.owner_name,
            document_number: document.document_number,
            phone: claim.phone,
            status: 'Matched',
        });
    }

    const claimedNumber = normalizeId(claim.document_number);
    const exact = Boolean(claimedNumber) && claimedNumber === normalizeId(document.document_number);
    const referenceCode = generateReferenceCode();

    const match = await base44.entities.Match.create({
        document_id: document.id,
        loss_report_id: report.id,
        owner_user_id: claim.owner_user_id,
        match_score: exact ? 100 : Math.round(nameSimilarity(claim.owner_name, document.owner_name) * 100),
                                                     match_type: exact ? 'Exact' : 'Fuzzy',
                                                     match_status: 'Confirmed',
                                                     reference_code: referenceCode,
    });

    await base44.entities.Claim.update(claim.id, {
        status: 'Approved',
        match_id: match.id,
        reference_code: referenceCode,
    });
    await base44.entities.LossReport.update(report.id, { status: 'Matched' });
    if (document.status !== 'Returned') {
        await base44.entities.Document.update(document.id, { status: 'Notified' });
    }

    await sendOwnerNotification({
        userId: claim.owner_user_id,
        message: buildFoundDocumentMessage({
            documentType: document.document_type,
            documentNumber: document.document_number,
            pickupPointName: pickupPoint ? pickupPoint.name : '',
            referenceCode,
        }),
    });

    await logAction({
        action: AUDIT_ACTIONS.CLAIM_APPROVED,
        details: `Claim ${claim.id} approved with reference ${referenceCode} (${maskDocumentNumber(document.document_number)})`,
                    user: actor,
    });

    return referenceCode;
}

export async function rejectClaim({ claim, document, actor }) {
    await base44.entities.Claim.update(claim.id, { status: 'Rejected' });

    await sendOwnerNotification({
        userId: claim.owner_user_id,
        message: [
            `LDRS: Your claim for a ${documentTypeLabel(document ? document.document_type : claim.document_type)}`,
                                `(${maskDocumentNumber(document ? document.document_number : claim.document_number)}) was not approved.`,
                                'Visit the pickup point with proof of ownership so an officer can verify it in person.',
        ].join(' '),
    });

    await logAction({
        action: AUDIT_ACTIONS.CLAIM_REJECTED,
        details: `Claim ${claim.id} rejected for document ${claim.document_id}`,
        user: actor,
    });
}
