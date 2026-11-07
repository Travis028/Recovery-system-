/** Officer review work: reminders, match decisions and ownership claims. */
import { ApiError, findById } from './db';
import { assertStation, audit, notifyUser, requireApprovedStaff } from './serverHelpers';
import { foundDocumentAlert } from '@/lib/notifications';
import { AUDIT_ACTIONS } from '@/lib/audit';

function confirmedMatchAtStation(actor, matchId) {
  const match = findById('Match', matchId);
  if (!match) throw new ApiError(404, 'Match not found.');
  const doc = findById('Document', match.document_id);
  if (!doc) throw new ApiError(404, 'Document not found.');
  assertStation(actor, doc);
  return { match, doc };
}

export const REVIEW_FUNCTIONS = {
  /** Sends the owner the pickup point and reference code again. The text is built here, not by the caller. */
  async sendCollectionReminder({ actor, args }) {
    requireApprovedStaff(actor);
    const { match, doc } = confirmedMatchAtStation(actor, args.match_id);
    if (match.match_status !== 'Confirmed') throw new ApiError(409, 'Only confirmed matches waiting for collection can be reminded.');
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
    await audit(actor, AUDIT_ACTIONS.NOTIFICATION_SENT, 'Collection reminder sent for match ' + match.id.slice(0, 8));
    return { status: 'ok' };
  },
};
