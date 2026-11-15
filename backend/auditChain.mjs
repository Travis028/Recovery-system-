/** LDRS v6 — tamper-evident audit trail (hash chain) on ldrs_v6.audit_log.
 * Each new entry stores prev_hash (the previous entry's hash) and
 * hash = SHA-256 of [prev_hash, id, user_id, action, details, actor_role, logged_at].
 * Changing, deleting or reordering any chained entry breaks verification.
 * Entries written before the chain existed (hash IS NULL) are reported as "before chain".
 */
import crypto from 'node:crypto';

const LOCK_KEY = 74501; // serialises appends so two entries never share a prev_hash

export function entryHash(prev, row) {
  const parts = [prev || '', row.id, row.user_id || '', row.action, row.details || '', row.actor_role || '', new Date(row.logged_at).toISOString()];
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Append one chained entry. `db` is the pool (own transaction) or a client already inside a transaction. */
export async function appendAudit(db, pool, { userId, action, details, actorRole }) {
  const own = db === pool;
  const conn = own ? await pool.connect() : db;
  try {
    if (own) await conn.query('BEGIN');
    await conn.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const last = (await conn.query('SELECT hash FROM ldrs_v6.audit_log WHERE hash IS NOT NULL ORDER BY seq DESC LIMIT 1')).rows[0]
      || { hash: await anchor(conn) }; // chain continues from the last entry removed by retention
    const row = { id: crypto.randomUUID(), user_id: userId || null, action, details: details ?? null, actor_role: actorRole ?? null, logged_at: new Date().toISOString() };
    const prev = last.hash || '';
    await conn.query(`INSERT INTO ldrs_v6.audit_log(id,user_id,action,details,actor_role,prev_hash,hash,logged_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [row.id, row.user_id, row.action, row.details, row.actor_role, prev, entryHash(prev, row), row.logged_at]);
    if (own) await conn.query('COMMIT');
  } catch (error) {
    if (own) await conn.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (own) conn.release();
  }
}

async function anchor(db) {
  const row = (await db.query(`SELECT value FROM ldrs_v6.settings WHERE key='_audit_chain_anchor'`)).rows[0];
  return typeof row?.value === 'string' ? row.value : '';
}

/** Retention: delete entries older than `days` (oldest first, never a gap) inside the caller's transaction.
 * The hash of the last deleted chained entry is kept as the anchor, so the remaining chain still verifies. */
export async function purgeAuditOlderThan(conn, days) {
  await conn.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
  const cut = (await conn.query(`SELECT max(seq) AS s FROM ldrs_v6.audit_log WHERE logged_at < now() - make_interval(days => $1)`, [days])).rows[0].s;
  if (!cut) return 0;
  const last = (await conn.query('SELECT hash FROM ldrs_v6.audit_log WHERE seq <= $1 AND hash IS NOT NULL ORDER BY seq DESC LIMIT 1', [cut])).rows[0];
  if (last) await conn.query(`INSERT INTO ldrs_v6.settings(key,value) VALUES('_audit_chain_anchor', to_jsonb($1::text))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [last.hash]);
  return (await conn.query('DELETE FROM ldrs_v6.audit_log WHERE seq <= $1', [cut])).rowCount;
}

/** Recompute every chained entry. Returns { ok, checked, legacy, brokenAt?, reason? } (shape used by the Audit trail screen). */
export async function verifyChain(pool) {
  const { rows } = await pool.query(`SELECT seq,id,user_id,action,details,actor_role,prev_hash,hash,logged_at FROM ldrs_v6.audit_log ORDER BY seq`);
  let prev = await anchor(pool); let started = false; let checked = 0; let legacy = 0;
  for (const row of rows) {
    if (!started && row.hash === null) { legacy += 1; continue; }
    started = true;
    if (row.hash === null) return { ok: false, checked, legacy, brokenAt: Number(row.seq), reason: 'fingerprint removed' };
    if ((row.prev_hash || '') !== prev) return { ok: false, checked, legacy, brokenAt: Number(row.seq), reason: 'link to the previous entry does not match (entry deleted or inserted)' };
    if (entryHash(prev, row) !== row.hash) return { ok: false, checked, legacy, brokenAt: Number(row.seq), reason: 'entry content was changed' };
    prev = row.hash; checked += 1;
  }
  return { ok: true, checked, legacy };
}
