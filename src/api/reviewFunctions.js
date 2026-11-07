/** Officer review work: reminders, match decisions and ownership claims. */
import { ApiError, findById, insert, patch, table, transaction } from './db';
import { assertStation, audit, notifyUser, requireApprovedStaff, requireRole } from './serverHelpers';
import { foundDocumentAlert } from '@/lib/notifications';
import { documentTypeLabel, generateReferenceCode, maskDocumentNumber, nameSimilarity, normalizeId, normalizePhone } from '@/lib/ldrs';
import { AUDIT_ACTIONS } from '@/lib/audit';

function matchAtStation(actor, matchId) {
  const match = findById('Match', matchId);
  if (!match) throw new ApiError(404, 'Match not found.');
  const doc = findById('Document', match.document_id);
  if (!doc) throw new ApiError(404, 'Document not found.');
  assertStation(actor, doc);
  return { match, doc };
}

function activeMatches(field, id, exceptId) {
  return table('Match').filter(function (row) {
    return row[field] === id && row.id !== exceptId && (row.match_status === 'Pending' || row.match_status === 'Confirmed');
  });
}

async function alertOwnerAboutMatch(actor, match, doc) {
  const point = findById('PickupPoint', doc.pickup_point_id);
  await notifyUser({
    actor,
    userId: match.owner_user_id,
    ...foundDocumentAlert({
      documentType: doc.document_type,
      documentNumber: doc.document_number,
      pickupPointName: point ? point.name : '',
      referenceCode: match.reference_code,
    }),
  });
}

export const REVIEW_FUNCTIONS = {
  /** Confirms a possible match: match, document and loss report change together, then the owner is alerted. */
  async confirmMatch({ actor, args }) {
    requireApprovedStaff(actor);
    const { match, doc } = matchAtStation(actor, args.match_id);
    if (match.match_status !== 'Pending') throw new ApiError(409, 'Only matches waiting for review can be confirmed.');
    if (doc.status === 'Returned') throw new ApiError(409, 'This document has already been returned.');

    const confirmed = transaction(function () {
      const updated = patch('Match', match.id, { match_status: 'Confirmed', reference_code: match.reference_code || generateReferenceCode() });
      patch('Document', doc.id, { status: 'Notified' });
      if (match.loss_report_id && findById('LossReport', match.loss_report_id)) patch('LossReport', match.loss_report_id, { status: 'Matched' });
      return updated;
    });

    await alertOwnerAboutMatch(actor, confirmed, doc);
    await audit(actor, AUDIT_ACTIONS.MATCH_CONFIRMED, 'Match ' + match.id.slice(0, 8) + ' confirmed with reference ' + confirmed.reference_code + ' (' + maskDocumentNumber(doc.document_number) + ')');
    await audit(actor, AUDIT_ACTIONS.NOTIFICATION_SENT, 'Owner alerted for confirmed match ' + match.id.slice(0, 8));
    return { reference_code: confirmed.reference_code };
  },

  /**
   * Rejects a pending or confirmed match. The document goes back to Found and the loss report
   * back to Open unless another active match still links them; unused collection codes are voided.
   */
  async rejectMatch({ actor, args }) {
    requireApprovedStaff(actor);
    const { match, doc } = matchAtStation(actor, args.match_id);
    if (match.match_status !== 'Pending' && match.match_status !== 'Confirmed') throw new ApiError(409, 'This match has already been decided.');

    transaction(function () {
      patch('Match', match.id, { match_status: 'Rejected' });
      if ((doc.status === 'Matched' || doc.status === 'Notified') && !activeMatches('document_id', doc.id, match.id).length) {
        patch('Document', doc.id, { status: 'Found' });
      }
      const report = match.loss_report_id ? findById('LossReport', match.loss_report_id) : null;
      if (report && report.status === 'Matched' && !activeMatches('loss_report_id', report.id, match.id).length) {
        patch('LossReport', report.id, { status: 'Open' });
      }
      table('OtpCode')
        .filter(function (row) {
          return row.match_id === match.id && !row.used;
        })
        .forEach(function (row) {
          patch('OtpCode', row.id, { used: true });
        });
    });

    await audit(actor, AUDIT_ACTIONS.MATCH_REJECTED, 'Match ' + match.id.slice(0, 8) + ' rejected');
    return { status: 'ok' };
  },

  /** Sends the owner the pickup point and reference code again. The text is built here, not by the caller. */
  async sendCollectionReminder({ actor, args }) {
    requireApprovedStaff(actor);
    const { match, doc } = matchAtStation(actor, args.match_id);
    if (match.match_status !== 'Confirmed') throw new ApiError(409, 'Only confirmed matches waiting for collection can be reminded.');
    await alertOwnerAboutMatch(actor, match, doc);
    await audit(actor, AUDIT_ACTIONS.NOTIFICATION_SENT, 'Collection reminder sent for match ' + match.id.slice(0, 8));
    return { status: 'ok' };
  },

  /* --- ownership claims --- */

  /** An owner claims a document they found through the masked search. */
  async submitClaim({ actor, args }) {
    requireRole(actor, ['Owner'], 'Only owners can claim a document.');
    const doc = findById('Document', args.document_id);
    if (!doc || ['Found', 'Matched', 'Notified'].indexOf(doc.status) < 0) throw new ApiError(404, 'This document is not available to claim.');
    const duplicate = table('Claim').some(function (row) {
      return row.document_id === doc.id && row.owner_user_id === actor.id && (row.status === 'Pending' || row.status === 'Approved');
    });
    if (duplicate) throw new ApiError(409, 'You have already claimed this document. Watch your alerts for the officer decision.');

    const claim = insert(
      'Claim',
      {
        document_id: doc.id,
        document_type: doc.document_type,
        owner_user_id: actor.id,
        owner_name: String(args.owner_name || '').trim(),
        phone: normalizePhone(args.phone),
        document_number: String(args.document_number || '').trim(),
        note: String(args.note || '').trim(),
        status: 'Pending',
      },
      actor.id,
    );
    await audit(actor, AUDIT_ACTIONS.CLAIM_SUBMITTED, 'Claim submitted for a ' + documentTypeLabel(doc.document_type) + ' (' + maskDocumentNumber(doc.document_number) + ')');
    return { id: claim.id };
  },

  /**
   * An officer accepts a claim. The owner's open report for this document type is reused if
   * there is one (officers cannot see it, so the screen used to create a second one), and the
   * confirmed match, the claim, the report and the document change together.
   */
  async approveClaim({ actor, args }) {
    requireApprovedStaff(actor);
    const claim = findById('Claim', args.claim_id);
    if (!claim) throw new ApiError(404, 'Claim not found.');
    if (claim.status !== 'Pending') throw new ApiError(409, 'This claim has already been decided.');
    const doc = findById('Document', claim.document_id);
    if (!doc) throw new ApiError(404, 'Document not found.');
    assertStation(actor, doc);
    if (doc.status === 'Returned') throw new ApiError(409, 'This document has already been returned.');

    const claimedNumber = normalizeId(claim.document_number);
    const exact = Boolean(claimedNumber) && claimedNumber === normalizeId(doc.document_number);
    const referenceCode = generateReferenceCode();

    const match = transaction(function () {
      let report = table('LossReport')
        .filter(function (row) {
          return row.owner_user_id === claim.owner_user_id && row.document_type === doc.document_type && (row.status === 'Open' || row.status === 'Matched');
        })
        .sort(function (a, b) {
          return a.created_date < b.created_date ? 1 : -1;
        })[0];
      if (!report) {
        report = insert(
          'LossReport',
          {
            owner_user_id: claim.owner_user_id,
            document_type: doc.document_type,
            owner_name: claim.owner_name,
            document_number: doc.document_number,
            phone: claim.phone,
            status: 'Matched',
          },
          actor.id,
        );
      }
      const created = insert('Match', {
        document_id: doc.id,
        loss_report_id: report.id,
        owner_user_id: claim.owner_user_id,
        match_score: exact ? 100 : Math.round(nameSimilarity(claim.owner_name, doc.owner_name) * 100),
        match_type: exact ? 'Exact' : 'Fuzzy',
        match_status: 'Confirmed',
        reference_code: referenceCode,
      });
      patch('Claim', claim.id, { status: 'Approved', match_id: created.id, reference_code: referenceCode });
      patch('LossReport', report.id, { status: 'Matched' });
      patch('Document', doc.id, { status: 'Notified' });
      return created;
    });

    await alertOwnerAboutMatch(actor, match, doc);
    await audit(actor, AUDIT_ACTIONS.CLAIM_APPROVED, 'Claim ' + claim.id.slice(0, 8) + ' approved with reference ' + referenceCode + ' (' + maskDocumentNumber(doc.document_number) + ')');
    return { reference_code: referenceCode };
  },

  async rejectClaim({ actor, args }) {
    requireApprovedStaff(actor);
    const claim = findById('Claim', args.claim_id);
    if (!claim) throw new ApiError(404, 'Claim not found.');
    if (claim.status !== 'Pending') throw new ApiError(409, 'This claim has already been decided.');
    const doc = findById('Document', claim.document_id);
    if (doc) assertStation(actor, doc);

    patch('Claim', claim.id, { status: 'Rejected' });
    const type = documentTypeLabel(doc ? doc.document_type : claim.document_type);
    const number = maskDocumentNumber(doc ? doc.document_number : claim.document_number);
    await notifyUser({
      actor,
      userId: claim.owner_user_id,
      message: 'LDRS: Your claim for a ' + type + ' (' + number + ') was not approved. Visit the pickup point with proof of ownership so an officer can check it in person.',
      messageSw: 'LDRS: Dai lako la ' + type + ' (' + number + ') halikukubaliwa. Tembelea mahali pa kuchukua ukiwa na uthibitisho wa umiliki ili afisa athibitishe ana kwa ana.',
    });
    await audit(actor, AUDIT_ACTIONS.CLAIM_REJECTED, 'Claim ' + claim.id.slice(0, 8) + ' rejected');
    return { status: 'ok' };
  },
};
