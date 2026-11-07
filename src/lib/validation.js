import { normalizeId } from '@/lib/ldrs';

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
