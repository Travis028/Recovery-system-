import { describe, expect, it } from 'vitest';
import { checkRecord } from '@/api/recordChecks';

describe('server-side record checks', () => {
  it('requires the basic details of a pickup point', () => {
    expect(checkRecord('PickupPoint', { name: 'Kondele Police Station', location: 'Kondele', county: 'Kisumu' })).toBe('');
    expect(checkRecord('PickupPoint', { name: '', location: 'Kondele', county: 'Kisumu' })).toMatch(/needs a name/);
  });

  it('checks the claimant name and phone, but not anonymised claims', () => {
    expect(checkRecord('Claim', { owner_name: 'Mary Kamau', phone: '0712345678' })).toBe('');
    expect(checkRecord('Claim', { owner_name: 'Mary Kamau', phone: '12' })).not.toBe('');
    expect(checkRecord('Claim', { owner_name: 'REMOVED', phone: '' })).toBe('');
  });

  it('only allows whole positive numbers for settings', () => {
    expect(checkRecord('Setting', { value: 10 })).toBe('');
    expect(checkRecord('Setting', { value: 0 })).not.toBe('');
    expect(checkRecord('Setting', { value: 2.5 })).not.toBe('');
  });

  it('leaves entities without extra rules alone', () => {
    expect(checkRecord('Match', {})).toBe('');
  });
});
