import { Input } from '@/components/ui/input';
import FormField from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTIES, subCountiesOf, wardsOf } from '@/lib/places';

/**
 * County -> Sub-county -> Ward -> Nearest landmark.
 * Choosing a county clears the sub-county and ward; choosing a sub-county clears the ward.
 * `fields` is the useFieldErrors object of the parent form. Field ids equal the error keys
 * (county, sub_county, ward, landmark) so a failed submit focuses the first wrong field.
 */
export default function PlaceFields({ place, onChange, fields, required, landmarkLabel, landmarkPlaceholder }) {
  const subs = subCountiesOf(place.county);
  const wards = wardsOf(place.county, place.sub_county);
  const set = function (patch) {
    onChange({ ...place, ...patch });
  };

  const choose = function (key, label, value, options, disabled, onPick) {
    return (
      <FormField id={key} label={label} required={required} optional={!required} error={fields.show(key)}>
        <Select value={value} onValueChange={onPick} disabled={disabled}>
          <SelectTrigger onBlur={fields.touch(key)}>
            <SelectValue placeholder={disabled ? 'Choose the level above first' : 'Select ' + label.toLowerCase()} />
          </SelectTrigger>
          <SelectContent>
            {options.map(function (option) {
              return (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </FormField>
    );
  };

  return (
    <>
      {choose('county', 'County', place.county, COUNTIES, false, function (value) { set({ county: value, sub_county: '', ward: '' }); })}
      {choose('sub_county', 'Sub-county', place.sub_county, subs, !place.county, function (value) { set({ sub_county: value, ward: '' }); })}
      {choose('ward', 'Ward', place.ward, wards, !place.sub_county, function (value) { set({ ward: value }); })}
      <FormField id="landmark" label={landmarkLabel} required={required} optional={!required} error={fields.show('landmark')}>
        <Input
          value={place.landmark}
          maxLength={120}
          placeholder={landmarkPlaceholder}
          onBlur={fields.touch('landmark')}
          onChange={function (e) { set({ landmark: e.target.value }); }}
        />
      </FormField>
    </>
  );
}
