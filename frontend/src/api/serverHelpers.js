/** Checks and side effects shared by the server functions. */
import { ApiError, findById, insert } from './db';
import { roleOf, shape } from './permissions';
import { appendAudit } from './auditStore';
import { deliverSms, SMS_SENDER_ID } from '@/lib/sms';
import { maskPhone } from '@/lib/ldrs';

export function audit(actor, action, details) {
  return appendAudit({
    user_id: actor && !actor.__system ? actor.id : null,
    actor_role: roleOf(actor) || 'Anonymous',
    action,
    details,
  });
}

export function requireRole(actor, roles, message) {
  const role = roleOf(actor);
  if (!actor) throw new ApiError(401, 'Please sign in.');
  if (role === 'System') return role;
  if (roles.indexOf(role) < 0) throw new ApiError(403, message || 'Your role cannot do this.');
  return role;
}

export function requireApprovedStaff(actor) {
  const role = requireRole(actor, ['Officer', 'Admin'], 'Only officers and administrators can do this.');
  if (role === 'Officer' && (!actor.approved || !actor.pickup_point_id)) {
    throw new ApiError(403, 'Your officer account is waiting for approval by an administrator.');
  }
  return role;
}

export function assertStation(actor, doc) {
  if (roleOf(actor) === 'Officer' && doc.pickup_point_id !== actor.pickup_point_id) {
    throw new ApiError(403, 'This document is held at another station.');
  }
}

export function pointName(id) {
  const point = findById('PickupPoint', id);
  return point ? point.name : '';
}

/**
 * Stores an in-app alert and, when the user has a verified phone, sends it by SMS in their
 * language. Six-digit codes are hidden in the stored copy of the SMS.
 */
export async function notifyUser({ actor, userId, message, messageSw, smsMessage, smsMessageSw }) {
  const owner = userId ? findById('User', userId) : null;
  const lang = owner && owner.language === 'sw' ? 'sw' : 'en';
  const text = lang === 'sw' && messageSw ? messageSw : message;
  const inApp = insert('Notification', { user_id: userId || null, message: text, channel: 'In-app', language: lang, delivery_status: 'In-app', sender: SMS_SENDER_ID }, actor.id);

  if (owner && owner.phone && owner.phone_verified) {
    const smsText = lang === 'sw' ? smsMessageSw || messageSw || text : smsMessage || text;
    const result = await deliverSms({ to: owner.phone, message: smsText });
    insert(
      'Notification',
      {
        user_id: owner.id,
        phone: maskPhone(owner.phone),
        message: smsText.replace(/\b\d{6}\b/g, '••••••'),
        channel: 'SMS',
        language: lang,
        sender: SMS_SENDER_ID,
        delivery_status: result.status,
        attempts: result.attempts,
      },
      actor.id,
    );
  }
  return shape('Notification', actor, inApp);
}
