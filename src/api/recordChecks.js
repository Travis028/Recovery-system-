/**
 * Field rules the data layer applies on every create and update, on top of the JSON
 * schemas (which only know types and allowed values). The screens run the same checks for
 * instant feedback; these are the ones that cannot be skipped.
 */
import { checkContactPhone, checkKenyanPhone, checkMaxLength, checkPersonName, checkRequired } from '@/lib/validation';

function first(...messages) {
  return messages.find(Boolean) || '';
}

const CHECKS = {
  PickupPoint: function (record) {
    return first(
      checkRequired(record.name, 'A pickup point needs a name.'),
      checkMaxLength(record.name, 120, 'The name'),
      checkRequired(record.location, 'A pickup point needs a location.'),
      checkMaxLength(record.location, 200, 'The location'),
      checkRequired(record.county, 'A pickup point needs a county.'),
      checkMaxLength(record.county, 60, 'The county'),
      checkContactPhone(record.contact_phone),
      checkMaxLength(record.opening_hours, 80, 'Opening hours'),
      checkMaxLength(record.verification_note, 500, 'The verification note'),
    );
  },
  Claim: function (record) {
    // A removal request anonymises old claims; those placeholders are not re-checked.
    if (record.owner_name === 'REMOVED') return '';
    return first(checkPersonName(record.owner_name), checkKenyanPhone(record.phone), checkMaxLength(record.note, 500, 'The note'), checkMaxLength(record.document_number, 20, 'The number'));
  },
  DataRequest: function (record) {
    return checkMaxLength(record.details, 1000, 'The details');
  },
  Setting: function (record) {
    const value = Number(record.value);
    return Number.isInteger(value) && value >= 1 && value <= 100000 ? '' : 'Settings must be whole numbers from 1 to 100000.';
  },
  User: function (record) {
    return first(checkRequired(record.full_name, 'An account needs a name.'), checkMaxLength(record.full_name, 120, 'The name'));
  },
};

/** Returns a message for the first broken rule, or '' when the record is acceptable. */
export function checkRecord(entity, record) {
  return CHECKS[entity] ? CHECKS[entity](record) : '';
}
