import { base44 } from '@/api/base44Client';
import { maskDocumentNumber } from '@/lib/ldrs';

/**
 * SMS placeholder.
 *
 * The production system will connect to an SMS provider such as Africa's Talking.
 * The outgoing message will not contain the full ID or certificate number — only a
 * partly hidden number, the pickup point and the reference code.
 *
 * TODO (Africa's Talking):
 *   const res = await fetch('https://api.africastalking.com/version1/messaging', {
 *     method: 'POST',
 *     headers: { apiKey: process.env.AT_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
 *     body: new URLSearchParams({ username: AT_USERNAME, to: phone, message }),
 *   });
 *   const { SMSMessageData } = await res.json();
 *   delivery_status = SMSMessageData?.Recipients?.[0]?.status || 'Failed';
 *
 * Until that service is connected every message is stored as an in-app system alert
 * so the owner can still see it on the Alerts screen.
 */
export async function sendSmsNotification({ userId, phone, message }) {
    console.info('[LDRS SMS placeholder] would send to', phone || '(no phone)', '\n', message);
    return base44.entities.Notification.create({
        user_id: userId || null,
        phone: phone || '',
        message,
        delivery_status: 'Simulated',
    });
}

export function buildFoundDocumentMessage({ documentType, documentNumber, pickupPointName, referenceCode }) {
    const pickup = pickupPointName || 'the pickup point shown in LDRS';
    return [
        `LDRS: A document that may be yours has been handed in (${documentType}).`,
        `Number on record (partly hidden): ${maskDocumentNumber(documentNumber)}.`,
        `Pickup point: ${pickup}.`,
        `Reference code: ${referenceCode}.`,
        'Warning: never share this reference code or your verification code with strangers.',
    ].join(' ');
}

export function buildOtpMessage({ referenceCode, pickupPointName, otpCode }) {
    const pickup = pickupPointName || 'the pickup point';
    return [
        `LDRS: Your collection code is ${otpCode} and it expires after 10 minutes.`,
        `Give this code only to the officer at ${pickup}.`,
        `Reference code: ${referenceCode}.`,
        'Warning: never share this code with strangers or send it to anyone by message.',
    ].join(' ');
}
