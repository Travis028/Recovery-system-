import { api } from '@/api/client';
import { normalizeId, nameSimilarity, generateReferenceCode, maskDocumentNumber } from '@/lib/ldrs';
import { sendOwnerNotification, foundDocumentAlert } from '@/lib/notifications';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';

export const FUZZY_NAME_THRESHOLD = 0.6;

function classify(reportNumberRaw, documentNumberRaw, reportName, documentName) {
  const reportNumber = normalizeId(reportNumberRaw);
  const documentNumber = normalizeId(documentNumberRaw);
  const exact = Boolean(reportNumber) && reportNumber === documentNumber;
  if (exact) return { matchType: 'Exact', score: 100 };
  const similarity = nameSimilarity(reportName, documentName);
  if (similarity >= FUZZY_NAME_THRESHOLD) return { matchType: 'Fuzzy', score: Math.round(similarity * 100) };
  return null;
}

function alreadyMatched(existing, documentId, reportId) {
  return existing.some(function (match) {
    return match.document_id === documentId && match.loss_report_id === reportId && match.match_status !== 'Rejected';
  });
}

/**
 * Compares a newly registered found document with every open loss report.
 *  - same type + same number        -> Exact match, confirmed, owner notified
 *  - same type + similar owner name -> Fuzzy match, pending, sent to officer review
 * Runs on the server (it needs to read other people's loss reports), so callers pass the
 * server client.
 */
export async function createMatchesForDocument({ doc, pickupPoint, actor, client }) {
  const source = client || api;
  const openReports = await source.entities.LossReport.filter({
    document_type: doc.document_type,
    status: 'Open',
  });
  const existing = await source.entities.Match.filter({ document_id: doc.id });

  const created = [];

  for (const report of openReports) {
    const result = classify(report.document_number, doc.document_number, report.owner_name, doc.owner_name);
    if (!result || alreadyMatched(existing, doc.id, report.id)) continue;

    const referenceCode = result.matchType === 'Exact' ? generateReferenceCode() : null;
    const match = await source.entities.Match.create({
      document_id: doc.id,
      loss_report_id: report.id,
      owner_user_id: report.owner_user_id,
      match_score: result.score,
      match_type: result.matchType,
      match_status: result.matchType === 'Exact' ? 'Confirmed' : 'Pending',
      reference_code: referenceCode,
    });

    if (result.matchType === 'Exact') {
      await source.entities.LossReport.update(report.id, { status: 'Matched' });
      await sendOwnerNotification({
        client: source,
        userId: report.owner_user_id,
        ...foundDocumentAlert({
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

    created.push({ match, report, notified: result.matchType === 'Exact' });
  }

  return created;
}

/**
 * The other direction: when an owner reports a document lost, documents that are already
 * being held are checked straight away, so a document handed in earlier is not missed.
 */
export async function matchLossReportAgainstHeldDocuments({ report, actor, client }) {
  const source = client || api;
  const held = await source.entities.Document.filter({
    document_type: report.document_type,
    status: { $in: ['Found', 'Matched'] },
  });
  if (!held.length) return [];

  const points = await source.entities.PickupPoint.list();
  const pointMap = {};
  points.forEach(function (point) {
    pointMap[point.id] = point;
  });

  const created = [];

  for (const doc of held) {
    const result = classify(report.document_number, doc.document_number, report.owner_name, doc.owner_name);
    if (!result) continue;

    const point = pointMap[doc.pickup_point_id] || null;
    const referenceCode = result.matchType === 'Exact' ? generateReferenceCode() : null;
    const match = await source.entities.Match.create({
      document_id: doc.id,
      loss_report_id: report.id,
      owner_user_id: report.owner_user_id,
      match_score: result.score,
      match_type: result.matchType,
      match_status: result.matchType === 'Exact' ? 'Confirmed' : 'Pending',
      reference_code: referenceCode,
    });

    if (result.matchType === 'Exact') {
      await source.entities.Document.update(doc.id, { status: 'Notified' });
      await source.entities.LossReport.update(report.id, { status: 'Matched' });
      await sendOwnerNotification({
        client: source,
        userId: report.owner_user_id,
        ...foundDocumentAlert({
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
    } else if (doc.status === 'Found') {
      await source.entities.Document.update(doc.id, { status: 'Matched' });
    }

    created.push({ match, document: doc, pickupPoint: point });
  }

  return created;
}
