import { base44 } from '@/api/base44Client';
import { maskDocumentNumber } from '@/lib/ldrs';

/**
 * Owner notifications are delivered inside the app: each message is stored as an
 * alert the owner sees on their dashboard and on the Alerts screen. No SMS is used.
 */
export async function sendOwnerNotification({ userId, message }) {
    return base44.entities.Notification.create({
        user_id: userId || null,
        message,
        delivery_status: 'In-app',
    });
}

export function buildFoundDocumentMessage({ documentType, documentNumber, pickupPointName, referenceCode }) {
    const pickup = pickupPointName || 'the pickup point shown on your dashboard';
    return [
        `LDRS: A document that may be yours has been handed in (${documentType}).`,
        `Number on record (partly hidden): ${maskDocumentNumber(documentNumber)}.`,
        `Pickup point: ${pickup}.`,
        `Reference code: ${referenceCode}.`,
        'Open your LDRS dashboard for the full collection details.',
    ].join(' ');
}

export function buildOtpMessage({ referenceCode, pickupPointName }) {
    const pickup = pickupPointName || 'the pickup point';
    return [
        'LDRS: A six-digit collection code has been generated and is shown on your LDRS dashboard.',
        `Give this code only to the officer at ${pickup}.`,
        `Reference code: ${referenceCode}.`,
        'Warning: never share this code with strangers or send it to anyone by message.',
    ].join(' ');
}
