import { maskPhone } from '@/lib/ldrs';

/**
 * SMS delivery.
 *
 * Production: set VITE_SMS_GATEWAY_URL to an endpoint on YOUR server that forwards the
 * message to Africa's Talking. The API key stays on that server — never in the browser.
 *
 *   // server side (Node), for reference
 *   const res = await fetch('https://api.africastalking.com/version1/messaging', {
 *     method: 'POST',
 *     headers: { apiKey: process.env.AT_API_KEY, Accept: 'application/json',
 *                'Content-Type': 'application/x-www-form-urlencoded' },
 *     body: new URLSearchParams({ username: process.env.AT_USERNAME, to, message, from: SMS_SENDER_ID }),
 *   });
 *   const status = (await res.json()).SMSMessageData?.Recipients?.[0]?.status; // 'Success' | ...
 *
 * Until a gateway is configured, messages go to the "Demo phone" panel in the app so the
 * flow can be tested without real numbers.
 *
 * Rules from the LDRS security review: one registered sender name; never the full name
 * or full ID number in a message; failed messages are retried and the result recorded.
 */

export const SMS_SENDER_ID = 'LDRS-KE';
const GATEWAY_URL = import.meta.env.VITE_SMS_GATEWAY_URL || '';
const OUTBOX_KEY = 'ldrs.demo-sms.v1';
const MAX_ATTEMPTS = 3;

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

export function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

export function clearOutbox() {
  localStorage.removeItem(OUTBOX_KEY);
  window.dispatchEvent(new CustomEvent('ldrs:sms'));
}

function simulate(to, message) {
  const entry = { to: maskPhone(to), message, from: SMS_SENDER_ID, at: new Date().toISOString() };
  const next = readOutbox().concat([entry]).slice(-30);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('ldrs:sms', { detail: entry }));
}

/** Sends one SMS with up to three attempts. Returns { status, attempts }. */
export async function deliverSms({ to, message }) {
  if (!to) return { status: 'Failed', attempts: 0, error: 'No phone number' };
  if (!GATEWAY_URL) {
    simulate(to, message);
    return { status: 'Simulated', attempts: 1 };
  }
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to, message, from: SMS_SENDER_ID }),
      });
      if (response.ok) return { status: 'Sent', attempts: attempt };
      lastError = 'Gateway answered ' + response.status;
    } catch (error) {
      lastError = error.message;
    }
    await wait(500 * attempt * attempt);
  }
  return { status: 'Failed', attempts: MAX_ATTEMPTS, error: lastError };
}


export function buildOtpSms({ referenceCode, pickupPointName, otpCode, minutes, lang }) {
  const pickup = pickupPointName || (lang === 'sw' ? 'mahali pa kuchukua' : 'the pickup point');
  if (lang === 'sw') {
    return [
      `LDRS: Nambari yako ya kuchukua ni ${otpCode}, itaisha baada ya dakika ${minutes}.`,
      `Mpe afisa wa ${pickup} pekee. Kumbukumbu: ${referenceCode}.`,
      'Usiwahi kuishiriki kwa simu au ujumbe.',
    ].join(' ');
  }
  return [
    `LDRS: Your collection code is ${otpCode} and it expires after ${minutes} minutes.`,
    `Give it only to the officer at ${pickup}. Reference: ${referenceCode}.`,
    'Never share it by phone or message.',
  ].join(' ');
}
