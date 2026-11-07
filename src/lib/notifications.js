import { api } from '@/api/client';
import { maskDocumentNumber } from '@/lib/ldrs';

/**
 * Owner notifications. Each alert is stored in the app (dashboard and Alerts screen) and,
 * when the owner has a verified phone, also sent by SMS. The server picks English or
 * Kiswahili from the owner's language setting, so callers pass both versions.
 */
export async function sendOwnerNotification({ userId, message, messageSw, smsMessage, smsMessageSw, client }) {
  const source = client || api;
  return source.functions.invoke('notifyOwner', { userId, message, messageSw, smsMessage, smsMessageSw });
}

export function buildFoundDocumentMessage({ documentType, documentNumber, pickupPointName, referenceCode, lang }) {
  if (lang === 'sw') {
    const pickup = pickupPointName || 'mahali palipoonyeshwa kwenye dashibodi yako';
    return [
      `LDRS: Hati inayoweza kuwa yako imeletwa (${documentType}).`,
      `Nambari iliyorekodiwa (sehemu imefichwa): ${maskDocumentNumber(documentNumber)}.`,
      `Mahali pa kuchukua: ${pickup}.`,
      `Nambari ya kumbukumbu: ${referenceCode}.`,
      'Fungua dashibodi yako ya LDRS kwa maelezo kamili ya kuchukua.',
    ].join(' ');
  }
  const pickup = pickupPointName || 'the pickup point shown on your dashboard';
  return [
    `LDRS: A document that may be yours has been handed in (${documentType}).`,
    `Number on record (partly hidden): ${maskDocumentNumber(documentNumber)}.`,
    `Pickup point: ${pickup}.`,
    `Reference code: ${referenceCode}.`,
    'Open your LDRS dashboard for the full collection details.',
  ].join(' ');
}

export function buildOtpMessage({ referenceCode, pickupPointName, lang }) {
  if (lang === 'sw') {
    const pickup = pickupPointName || 'mahali pa kuchukua';
    return [
      'LDRS: Nambari ya kuchukua yenye tarakimu sita imetolewa na inaonekana kwenye dashibodi yako ya LDRS.',
      `Mpe afisa wa ${pickup} pekee.`,
      `Nambari ya kumbukumbu: ${referenceCode}.`,
      'Onyo: usiwahi kushiriki nambari hii na mtu usiyemjua wala kuituma kwa ujumbe.',
    ].join(' ');
  }
  const pickup = pickupPointName || 'the pickup point';
  return [
    'LDRS: A six-digit collection code has been generated and is shown on your LDRS dashboard.',
    `Give this code only to the officer at ${pickup}.`,
    `Reference code: ${referenceCode}.`,
    'Warning: never share this code with strangers or send it to anyone by message.',
  ].join(' ');
}

/** Both language versions of the "document found" alert, ready for sendOwnerNotification. */
export function foundDocumentAlert(params) {
  return {
    message: buildFoundDocumentMessage({ ...params, lang: 'en' }),
    messageSw: buildFoundDocumentMessage({ ...params, lang: 'sw' }),
  };
}
