import { describe, expect, it } from 'vitest';
import {
  checkContactPhone,
  checkDocumentNumber,
  checkEmail,
  checkKenyanPhone,
  checkPassword,
  checkPastDate,
  checkPersonName,
  collectErrors,
} from '@/lib/validation';

describe('document numbers', () => {
  it('accepts numbers in the official format for the type', () => {
    expect(checkDocumentNumber('National ID', '28456713')).toBe('');
    expect(checkDocumentNumber('Passport', 'AK7654321')).toBe('');
  });

  it('explains what is wrong with a number in the wrong format', () => {
    expect(checkDocumentNumber('National ID', '12AB')).toMatch(/7 to 8 digits/);
    expect(checkDocumentNumber('Passport', '')).toMatch(/Enter the number/);
  });
});

describe('people and contacts', () => {
  it('needs two names made of letters', () => {
    expect(checkPersonName('Mary Kamau')).toBe('');
    expect(checkPersonName('Mary')).toMatch(/two names/);
    expect(checkPersonName('M4ry K4mau')).toMatch(/letters only/);
  });

  it('checks email and phone format', () => {
    expect(checkEmail('owner@ldrs.test')).toBe('');
    expect(checkEmail('owner@')).not.toBe('');
    expect(checkKenyanPhone('', { optional: true })).toBe('');
    expect(checkKenyanPhone('12345')).not.toBe('');
  });

  it('accepts office landlines for pickup points', () => {
    expect(checkContactPhone('057 202 3456')).toBe('');
    expect(checkContactPhone('call us')).not.toBe('');
  });

  it('lists every missing password rule', () => {
    expect(checkPassword('Owner@LDRS2026')).toBe('');
    expect(checkPassword('short')).toMatch(/10 characters.*upper-case.*number/);
  });
});

describe('dates and forms', () => {
  it('refuses dates in the future', () => {
    expect(checkPastDate('2000-01-01', 'date lost')).toBe('');
    expect(checkPastDate('2999-01-01', 'date lost')).toMatch(/cannot be in the future/);
  });

  it('collects only the fields that have a message', () => {
    expect(collectErrors({ a: () => '', b: () => 'Needed.' })).toEqual({ b: 'Needed.' });
  });
});
