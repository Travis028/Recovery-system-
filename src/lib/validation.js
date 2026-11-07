import { isValidKenyanPhone, normalizeId } from '@/lib/ldrs';
import { passwordProblems } from '@/api/crypto';

/**
 * Number format checks per document type. A reading that does not fit the format is
 * almost always an OCR or typing mistake, and a wrong number can cause a false match.
 */
const FORMATS = {
  'National ID': { pattern: /^\d{7,8}$/, hint: '7 to 8 digits' },
  Passport: { pattern: /^[A-Z]{1,2}\d{6,8}$/, hint: 'one or two letters followed by 6 to 8 digits, for example AK1234567' },
  "Driver's License": { pattern: /^[A-Z0-9]{6,12}$/, hint: '6 to 12 letters or digits' },
  'Birth Certificate': { pattern: /^\d{6,10}$/, hint: '6 to 10 digits' },
  'NHIF Health Card': { pattern: /^\d{6,12}$/, hint: '6 to 12 digits' },
  'NSSF Card': { pattern: /^\d{6,12}$/, hint: '6 to 12 digits' },
};

export function numberFormatHint(type) {
  return FORMATS[type] ? FORMATS[type].hint : 'letters and digits only';
}

/** Returns an error message, or '' when the number is acceptable. */
export function checkDocumentNumber(type, value) {
  const normalized = normalizeId(value);
  if (!normalized) return 'Enter the number printed on the document.';
  if (normalized.length < 4 || normalized.length > 20) return 'The number should be between 4 and 20 characters.';
  const format = FORMATS[type];
  if (format && !format.pattern.test(normalized)) {
    return 'This does not look like a ' + type + ' number (' + format.hint + '). Check it against the document.';
  }
  return '';
}

export function checkPersonName(value) {
  const name = String(value || '').trim();
  if (name.length < 3) return 'Enter the name shown on the document.';
  if (!/^[A-Za-z'\- .]+$/.test(name)) return 'Use letters only for the name.';
  if (name.split(/\s+/).length < 2) return 'Enter at least two names, as printed on the document.';
  return '';
}

/* Field checks shared by the forms and the server functions. Each returns '' when the value is fine. */

export function checkRequired(value, message) {
  return String(value === undefined || value === null ? '' : value).trim() ? '' : message || 'This field is required.';
}

export function checkEmail(value) {
  const email = String(value || '').trim();
  if (!email) return 'Enter your email address.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter an email address like name@example.com.';
}

export function checkFullName(value) {
  const name = String(value || '').trim();
  if (name.length < 3) return 'Enter your full name.';
  if (!/^[A-Za-z'\- .]+$/.test(name)) return 'Use letters only for the name.';
  return '';
}

export function checkKenyanPhone(value, { optional = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return optional ? '' : 'Enter a phone number.';
  return isValidKenyanPhone(raw) ? '' : 'Enter a Kenyan mobile number, for example 0712 345 678.';
}

export function checkPassword(value) {
  const problems = passwordProblems(value);
  return problems.length ? 'The password needs ' + problems.join(', ') + '.' : '';
}

export function checkCode(value, length = 6) {
  return new RegExp('^\\d{' + length + '}$').test(String(value || '').trim()) ? '' : 'Enter the ' + length + '-digit code.';
}

/** Dates are compared as YYYY-MM-DD strings in local time. */
export function checkPastDate(value, label = 'date') {
  if (!value) return 'Enter the ' + label + '.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter a valid ' + label + '.';
  return value > todayIso() ? 'The ' + label + ' cannot be in the future.' : '';
}

export function checkMaxLength(value, max, label = 'This field') {
  return String(value || '').length > max ? label + ' must be ' + max + ' characters or fewer.' : '';
}

export function todayIso() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

/** Runs a map of { field: () => message } and returns only the fields with a message. */
export function collectErrors(checks) {
  const errors = {};
  Object.keys(checks).forEach(function (field) {
    const message = checks[field]();
    if (message) errors[field] = message;
  });
  return errors;
}
