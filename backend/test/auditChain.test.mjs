import test from 'node:test';
import assert from 'node:assert/strict';
import { entryHash, verifyChain } from '../auditChain.mjs';

function chain(n, legacy = 0) {
  const rows = []; let prev = '';
  for (let i = 0; i < legacy; i++) rows.push({ seq: i + 1, id: 'l' + i, user_id: null, action: 'old', details: null, actor_role: null, prev_hash: null, hash: null, logged_at: new Date(2026, 0, 1) });
  for (let i = 0; i < n; i++) {
    const row = { seq: legacy + i + 1, id: 'id' + i, user_id: 'u', action: 'login', details: 'd' + i, actor_role: 'Admin', logged_at: new Date(2026, 10, 9, 6, i) };
    row.prev_hash = prev; row.hash = entryHash(prev, row); prev = row.hash; rows.push(row);
  }
  return rows;
}
const poolOf = (rows) => ({ query: async () => ({ rows }) });

test('intact chain verifies; older unchained entries are counted separately', async () => {
  assert.deepEqual(await verifyChain(poolOf(chain(5, 3))), { ok: true, checked: 5, legacy: 3 });
});
test('edited entry is detected', async () => {
  const rows = chain(5); rows[2].details = 'changed';
  const r = await verifyChain(poolOf(rows)); assert.equal(r.ok, false); assert.equal(r.brokenAt, 3); assert.match(r.reason, /changed/);
});
test('deleted entry is detected', async () => {
  const rows = chain(5); rows.splice(1, 1);
  const r = await verifyChain(poolOf(rows)); assert.equal(r.ok, false); assert.equal(r.brokenAt, 3); assert.match(r.reason, /deleted/);
});
test('removed fingerprint inside the chain is detected', async () => {
  const rows = chain(4); rows[3].hash = null;
  const r = await verifyChain(poolOf(rows)); assert.equal(r.ok, false); assert.equal(r.brokenAt, 4);
});
