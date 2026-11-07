/** Officer review work: reminders, match decisions and ownership claims. */
import { ApiError, findById, patch, table, transaction } from './db';
import { assertStation, audit, notifyUser, requireApprovedStaff } from './serverHelpers';
import { foundDocumentAlert } from '@/lib/notifications';
import { generateReferenceCode, maskDocumentNumber } from '@/lib/ldrs';
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
};
