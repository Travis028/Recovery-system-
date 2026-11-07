/**
 * Append-only audit trail, kept apart from the main database (its own storage key; in
 * production its own server). Each entry stores the hash of the entry before it, so
 * changing or deleting any entry breaks the chain and shows up in verifyChain().
 * There is no update or delete function: entries can only be added, or removed in bulk
 * when they pass the agreed retention period.
 */
import { randomId, sha256Hex } from './crypto';

const AUDIT_KEY = 'ldrs.audit.v1';
const GENESIS = '0'.repeat(64);

let queue = Promise.resolve();

function read() {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch (error) {
    console.error('Audit store unreadable', error);
  }
  return { anchor: GENESIS, entries: [] };
}

function write(store) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(store));
}

function canonical(entry) {
  return JSON.stringify([
    entry.seq,
    entry.id,
    entry.created_date,
    entry.user_id || null,
    entry.actor_role || null,
    entry.action,
    entry.details || '',
    entry.prev_hash,
  ]);
}

export function appendAudit({ user_id, actor_role, action, details }) {
  const job = queue.then(async function () {
    const store = read();
    const last = store.entries[store.entries.length - 1];
    const entry = {
      id: randomId(),
      seq: last ? last.seq + 1 : 1,
      created_date: new Date().toISOString(),
      user_id: user_id || null,
      actor_role: actor_role || null,
      action: String(action || 'Unknown action'),
      details: String(details || '').slice(0, 1000),
      prev_hash: last ? last.hash : store.anchor,
    };
    entry.hash = await sha256Hex(canonical(entry));
    store.entries.push(entry);
    write(store);
    return entry;
  });
  queue = job.catch(function () {});
  return job;
}

export function listAudit() {
  return read().entries.slice();
}

/** Recomputes every hash. Returns the first broken entry, if any. */
export async function verifyChain() {
  const store = read();
  let previous = store.anchor;
  for (let i = 0; i < store.entries.length; i += 1) {
    const entry = store.entries[i];
    if (entry.prev_hash !== previous) {
      return { ok: false, checked: i, brokenAt: entry.seq, reason: 'Link to the previous entry is broken (entry removed or reordered).' };
    }
    const expected = await sha256Hex(canonical(entry));
    if (expected !== entry.hash) {
      return { ok: false, checked: i, brokenAt: entry.seq, reason: 'Entry content was changed after it was written.' };
    }
    previous = entry.hash;
  }
  return { ok: true, checked: store.entries.length };
}

/**
 * Removes entries older than the retention period. The hash of the last removed entry
 * becomes the new anchor, so the remaining chain still verifies.
 */
export function purgeAuditOlderThan(days) {
  const job = queue.then(function () {
    const store = read();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removed = 0;
    while (store.entries.length && new Date(store.entries[0].created_date).getTime() < cutoff) {
      store.anchor = store.entries[0].hash;
      store.entries.shift();
      removed += 1;
    }
    write(store);
    return removed;
  });
  queue = job.catch(function () {});
  return job;
}

export function exportAuditStore() {
  return read();
}

export function importAuditStore(data) {
  if (data && Array.isArray(data.entries)) write({ anchor: data.anchor || GENESIS, entries: data.entries });
}
