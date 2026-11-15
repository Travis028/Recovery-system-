/**
 * Cryptography helpers built on the browser's Web Crypto API.
 *
 * Production note: passwords will be hashed on the server with bcrypt or Argon2.
 * This prototype uses PBKDF2-SHA256 (310 000 iterations, per-user salt), which is the
 * strongest password hash available natively in the browser.
 */

const PBKDF2_ITERATIONS = 310000;
const encoder = new TextEncoder();

export function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(function (byte) {
      return byte.toString(16).padStart(2, '0');
    })
    .join('');
}

export function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export function randomHex(bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toHex(buffer);
}

export function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return randomHex(16);
}

/** Uniformly random numeric code (no modulo bias). */
export function randomDigits(length = 6) {
  let out = '';
  const buffer = new Uint8Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < 250) out += String(buffer[0] % 10);
  }
  return out;
}

export async function sha256Hex(input) {
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex || randomHex(16);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256,
  );
  return { hash: 'pbkdf2$' + PBKDF2_ITERATIONS + '$' + toHex(bits), salt };
}

/** Constant-time string comparison. */
export function safeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return diff === 0;
}

export async function verifyPassword(password, storedHash, saltHex) {
  if (!storedHash || !saltHex) return false;
  const { hash } = await hashPassword(password, saltHex);
  return safeEqual(hash, storedHash);
}

/** Password rules: at least 10 characters with upper case, lower case and a digit. */
export function passwordProblems(password) {
  const value = String(password || '');
  const problems = [];
  if (value.length < 10) problems.push('at least 10 characters');
  if (!/[a-z]/.test(value)) problems.push('a lower-case letter');
  if (!/[A-Z]/.test(value)) problems.push('an upper-case letter');
  if (!/[0-9]/.test(value)) problems.push('a number');
  return problems;
}
