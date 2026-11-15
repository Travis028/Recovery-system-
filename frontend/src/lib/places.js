// Kenya county -> sub-county -> ward lists (shared/kenya-admin-units.json, also used by the backend).
import data from '@shared/kenya-admin-units.json';

const byCounty = new Map(
  data.counties.map(function (c) {
    return [c.county, new Map(c.sub_counties.map(function (s) { return [s.name, s.wards]; }))];
  }),
);

export const COUNTIES = data.counties.map(function (c) { return c.county; });

export function subCountiesOf(county) {
  const subs = byCounty.get(county);
  return subs ? Array.from(subs.keys()) : [];
}

export function wardsOf(county, subCounty) {
  const subs = byCounty.get(county);
  return (subs && subs.get(subCounty)) || [];
}

export const EMPTY_PLACE = { county: '', sub_county: '', ward: '', landmark: '' };

/** Same wording as the backend's describePlace (kept in found_location). */
export function describePlace(place) {
  return [place.landmark, place.ward && place.ward + ' Ward', place.sub_county, place.county && place.county + ' County']
    .filter(Boolean)
    .join(', ')
    .slice(0, 200);
}

/** Field checks. required=true for finders (all four), false for owners (optional but consistent). */
export function placeErrors(place, required) {
  const landmark = String(place.landmark || '').trim();
  return {
    county: required && !place.county ? 'Choose the county.' : '',
    sub_county: (required || place.ward) && !place.sub_county ? 'Choose the sub-county.' : '',
    ward: required && !place.ward ? 'Choose the ward.' : '',
    landmark:
      required && landmark.length < 3
        ? 'Enter the nearest landmark.'
        : landmark && landmark.length < 3
          ? 'The landmark is too short.'
          : landmark.length > 120
            ? 'Keep the landmark under 120 characters.'
            : '',
  };
}
