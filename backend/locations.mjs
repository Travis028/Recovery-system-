/** LDRS v6 — Kenya county / sub-county / ward checks (data: shared/kenya-admin-units.json). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'kenya-admin-units.json');
const counties = JSON.parse(fs.readFileSync(file, 'utf8')).counties;
const byCounty = new Map(counties.map(c => [c.county, new Map(c.sub_counties.map(s => [s.name, new Set(s.wards)]))]));

class PlaceError extends Error { constructor(message) { super(message); this.status = 422; } }
const clean = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

/**
 * Validate a place. required=true (finder): all four fields needed.
 * required=false (owner): all optional, but whatever is given must be consistent
 * (a sub-county needs its county, a ward needs its sub-county).
 * Returns { county, sub_county, ward, landmark } with nulls for blanks.
 */
export function checkPlace(args, required) {
  const county = clean(args.county, 60), sub = clean(args.sub_county, 80), ward = clean(args.ward, 80), landmark = clean(args.landmark, 120);
  if (required) {
    if (!county) throw new PlaceError('Choose the county.');
    if (!sub) throw new PlaceError('Choose the sub-county.');
    if (!ward) throw new PlaceError('Choose the ward.');
    if (landmark.length < 3) throw new PlaceError('Enter the nearest landmark (at least 3 characters).');
  }
  if (county && !byCounty.has(county)) throw new PlaceError('Unknown county.');
  if (sub && (!county || !byCounty.get(county).has(sub))) throw new PlaceError('That sub-county is not in the chosen county.');
  if (ward && (!sub || !byCounty.get(county).get(sub).has(ward))) throw new PlaceError('That ward is not in the chosen sub-county.');
  if (landmark && landmark.length < 3) throw new PlaceError('The landmark is too short.');
  return { county: county || null, sub_county: sub || null, ward: ward || null, landmark: landmark || null };
}

/** One-line description kept in documents.found_location for older screens and search. */
export function describePlace(place) {
  return [place.landmark, place.ward && place.ward + ' Ward', place.sub_county, place.county && place.county + ' County'].filter(Boolean).join(', ').slice(0, 200);
}

export const KENYA_TOTALS = { counties: counties.length, sub_counties: counties.reduce((n, c) => n + c.sub_counties.length, 0) };
