import crypto from 'node:crypto';

export const SCHEMA = 'ldrs_v6';
export const PUBLIC_ROLES = Object.freeze(['Owner', 'Finder', 'Officer']);
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function required(value, name, maxLength = 250) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    fail(422, `${name} is required (maximum ${maxLength} characters).`);
  }
  return value.trim();
}
export function validateEmail(value) {
  const email = required(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, 'Enter a valid email address.');
  return email;
}
export function validatePublicRole(role) {
  if (!PUBLIC_ROLES.includes(role)) fail(422, 'Choose Owner, Finder or Officer.');
  return role;
}
export function passwordRules(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128 &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}
export function createPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  if (!passwordRules(password)) fail(422, 'Password needs 12–128 characters, upper/lowercase letters and a number.');
  return { salt, hash: crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex') };
}
export function verifyPassword(password, salt, expectedHash) {
  // Perform work for unknown users too to limit user-enumeration timing differences.
  const actual = crypto.pbkdf2Sync(String(password || ''), salt || '0'.repeat(32), 310000, 32, 'sha256');
  const expected = Buffer.from(expectedHash || '0'.repeat(64), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
export const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export function otpDigest(secret, challengeId, code) {
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}
export function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email, full_name: row.full_name,
    phone: row.phone || '', phone_verified: !!row.phone_verified,
    role: row.role, ldrs_role: row.ldrs_role || null,
    approved: !!row.approved, pickup_point_id: row.pickup_point_id || '',
    language: row.language || 'en', disabled: !!row.disabled,
    created_date: row.created_at,
  };
}
export function cookieFor(token, secure = false) {
  return `ldrs_session=${token}; HttpOnly; SameSite=Strict; Path=/api/v6; Max-Age=28800${secure ? '; Secure' : ''}`;
}
export function emptyCookie(secure = false) {
  return `ldrs_session=; HttpOnly; SameSite=Strict; Path=/api/v6; Max-Age=0${secure ? '; Secure' : ''}`;
}
export function extractToken(cookieHeader) {
  const match = String(cookieHeader || '').match(/(?:^|;\s*)ldrs_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}
