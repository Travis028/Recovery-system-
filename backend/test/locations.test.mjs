import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPlace, describePlace, KENYA_TOTALS } from '../locations.mjs';

const kondele = { county: 'Kisumu', sub_county: 'Kisumu Central', ward: 'Kondele', landmark: 'Kondele roundabout' };

test('dataset has 47 counties and 301 sub-counties', () => {
  assert.deepEqual(KENYA_TOTALS, { counties: 47, sub_counties: 301 });
});
test('finder place: valid chain accepted and described', () => {
  const p = checkPlace(kondele, true);
  assert.deepEqual(p, kondele);
  assert.equal(describePlace(p), 'Kondele roundabout, Kondele Ward, Kisumu Central, Kisumu County');
});
test('finder place: every level is required', () => {
  for (const missing of ['county', 'sub_county', 'ward', 'landmark'])
    assert.throws(() => checkPlace({ ...kondele, [missing]: '' }, true), { status: 422 });
});
test('mismatched levels are refused', () => {
  assert.throws(() => checkPlace({ ...kondele, ward: 'Kilimani' }, true), /not in the chosen sub-county/);
  assert.throws(() => checkPlace({ ...kondele, sub_county: 'Westlands' }, true), /not in the chosen county/);
  assert.throws(() => checkPlace({ ...kondele, county: 'Atlantis' }, true), /Unknown county/);
});
test('owner place: all optional, partial allowed but must be consistent', () => {
  assert.deepEqual(checkPlace({}, false), { county: null, sub_county: null, ward: null, landmark: null });
  assert.equal(checkPlace({ county: 'Siaya' }, false).county, 'Siaya');
  assert.throws(() => checkPlace({ sub_county: 'Bondo' }, false), { status: 422 });
});
