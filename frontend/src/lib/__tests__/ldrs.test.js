import { describe, expect, it } from 'vitest';
import { isValidKenyanPhone, maskDocumentNumber, maskName, maskPhone, nameSimilarity, normalizeId, normalizePhone } from '@/lib/ldrs';

describe('masking', () => {
  it('keeps only the last four characters of a document number', () => {
    expect(maskDocumentNumber('28456713')).toBe('••••6713');
    expect(maskDocumentNumber('AK 765 4321')).toBe('•••••4321');
    expect(maskDocumentNumber('')).toBe('Not provided');
  });

  it('keeps the first name and initials of the other names', () => {
    expect(maskName('MARY WANJIRU KAMAU')).toBe('MARY W•••••• K••••');
  });

  it('shows the start and end of a phone number', () => {
    expect(maskPhone('0712345678')).toBe('0712•••678');
  });
});

describe('phone numbers', () => {
  it('accepts Kenyan mobile numbers in local and international form', () => {
    expect(isValidKenyanPhone('0712 345 678')).toBe(true);
    expect(isValidKenyanPhone('+254712345678')).toBe(true);
    expect(isValidKenyanPhone('0112345678')).toBe(true);
    expect(normalizePhone('254712345678')).toBe('0712345678');
  });

  it('rejects numbers that are too short or not mobile numbers', () => {
    expect(isValidKenyanPhone('071234567')).toBe(false);
    expect(isValidKenyanPhone('0572023456')).toBe(false);
  });
});

describe('matching helpers', () => {
  it('ignores spacing and case in document numbers', () => {
    expect(normalizeId(' ak-765 4321 ')).toBe('AK7654321');
  });

  it('scores identical names as 1 and similar names highly', () => {
    expect(nameSimilarity('Mary Wanjiru Kamau', 'MARY WANJIRU KAMAU')).toBe(1);
    expect(nameSimilarity('Mary Wanjiru Kamau', 'Mary Kamau')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('Mary Wanjiru Kamau', 'Peter Kiprotich')).toBeLessThan(0.6);
  });
});
