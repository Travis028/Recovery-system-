/** LDRS v6 — collection code, secure handover and public receipt verification.
 * Uses the existing ldrs_v6 schema; fictional localhost demo only.
 * No SMS provider is integrated: generation is deliberately disabled outside LDRS_DEMO_OTP=1.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(ROOT, '.private-collection-key');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(['National ID', 'Passport', "Driver's License", 'Employment ID', 'Other']);
const MAX_ATTEMPTS = 3;
const EXPIRY_MINUTES = 5;

function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
function need(condition, message, status = 422) { if (!condition) fail(status, message); }
function trim(x, max = 250) { return String(x ?? '').trim().slice(0, max); }
function normalized(x) { return trim(x, 200).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function roleOf(user) { return user.role === 'admin' ? 'Admin' : user.ldrs_role; }
function authorizedStaff(user) {
  const role = roleOf(user);
  need(role === 'Admin' || (role === 'Officer' && user.approved && user.pickup_point_id),
    'Approved officer or administrator access required.', 403);
  return role;
}
function verifiedId(value) { need(UUID.test(String(value || '')), 'Invalid record ID.'); return value; }
function secretKey() {
  // Persist key locally. Do not commit/copy publicly; losing it invalidates old receipt hashes and OTPs.
  try { fs.writeFileSync(KEY_FILE, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  const b = fs.readFileSync(KEY_FILE);
  need(b.length === 32, 'Collection signing key is invalid.', 500);
  return b;
}
export function digestCode(key, id, code) {
  return crypto.createHmac('sha256', key).update('otp:' + id + ':' + code).digest('hex');
}
export function constantEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function receiptFields(row) {
  return [row.id, row.document_id, row.match_id, row.officer_user_id,
    row.released_to, row.claimant_id_type, row.claimant_id_number,
    row.pickup_point_id, new Date(row.created_at).toISOString()]
    .map(x => String(x ?? '')).join('\x1f');
}
export function receiptDigest(key, row) {
  return crypto.createHmac('sha256', key).update('receipt:' + receiptFields(row)).digest('hex');
}
function otpMetadata(row) {
  if (!row) return null;
  return { id: row.id, match_id: row.match_id, expires_at: row.expires_at,
    used: Boolean(row.used), attempts: Number(row.attempts || 0),
    locked: Boolean(row.locked), created_at: row.created_at, created_date: row.created_at };
}
async function findAuthorizedMatch(conn, user, matchId, lock = false) {
  authorizedStaff(user);
  verifiedId(matchId);
  const { rows } = await conn.query(`SELECT m.id,m.document_id,m.owner_user_id,m.loss_report_id,
    m.match_status,m.reference_code,d.status AS document_status,d.pickup_point_id,
    d.document_number,d.document_type
    FROM ldrs_v6.matches m JOIN ldrs_v6.documents d ON d.id=m.document_id
    WHERE m.id=$1 ${lock ? 'FOR UPDATE OF m,d' : ''}`, [matchId]);
  const match = rows[0];
  need(match, 'Match not found.', 404);
  if (roleOf(user) === 'Officer') {
    need(match.pickup_point_id === user.pickup_point_id, 'This document belongs to another station.', 403);
    const status = await conn.query(`SELECT 1 FROM ldrs_v6.pickup_points WHERE id=$1 AND active=true AND verified=true`, [user.pickup_point_id]);
    need(status.rows.length, 'Your station is not active and verified.', 403);
  }
  return match;
}
function requireCollectible(match) {
  need(match.match_status === 'Confirmed' && match.document_status !== 'Returned',
    'This document is not waiting for collection.', 409);
  need(match.owner_user_id, 'A verified owner is required.', 422);
}

export async function handoverWorkflow(ctx, name, args = {}) {
  const {pool, user, audit} = ctx;
  const role = authorizedStaff(user);
  if (name === 'getCollectionCodeStatus') {
    await findAuthorizedMatch(pool, user, args.match_id);
    const {rows} = await pool.query(`SELECT id,match_id,expires_at,used,attempts,locked,created_at
      FROM ldrs_v6.otp_codes WHERE match_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [args.match_id]);
    return otpMetadata(rows[0]);
  }
  if (name === 'generateCollectionCode') {
    // Fail closed; development terminal code is not real SMS delivery.
    need(process.env.LDRS_DEMO_OTP === '1', 'Collection SMS delivery is not configured. Release is disabled.', 503);
    const client = await pool.connect(); let committed = false; let value; let code;
    try {
      await client.query('BEGIN');
      const match = await findAuthorizedMatch(client, user, args.match_id, true);
      requireCollectible(match);
      const recent = await client.query(`SELECT count(*)::int AS n FROM ldrs_v6.rate_events
        WHERE user_id=$1 AND kind='collection_code' AND created_at>now()-interval '1 hour'`, [user.id]);
      need(recent.rows[0].n < 5, 'Too many collection codes requested. Try again later.', 429);
      code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const id = crypto.randomUUID();
      await client.query(`UPDATE ldrs_v6.otp_codes SET used=true
        WHERE match_id=$1 AND used=false`, [match.id]);
      const result = await client.query(`INSERT INTO ldrs_v6.otp_codes
        (id,match_id,owner_user_id,otp_hash,expires_at)
        VALUES ($1,$2,$3,$4,now()+interval '5 minutes')
        RETURNING id,match_id,expires_at,used,attempts,locked,created_at`,
      [id,match.id,match.owner_user_id,digestCode(secretKey(),id,code)]);
      value = otpMetadata(result.rows[0]);
      await client.query(`INSERT INTO ldrs_v6.rate_events(id,user_id,kind) VALUES ($1,$2,'collection_code')`, [crypto.randomUUID(), user.id]);
      await client.query(`INSERT INTO ldrs_v6.notifications(id,user_id,message,channel,delivery_status)
        VALUES ($1,$2,$3,'In-app','Simulated')`, [crypto.randomUUID(), match.owner_user_id,
        'LDRS local test: a collection code was issued. SMS is not connected. Ask the test operator for the simulated code.']);
      await audit(user.id, 'collection_code_generated', `Collection code issued for match ${match.id}; ${EXPIRY_MINUTES} minute expiry`, role, client);
      await client.query('COMMIT'); committed = true;
    } catch (e) { if (!committed) await client.query('ROLLBACK').catch(()=>{}); throw e; }
    finally { client.release(); }
    process.stdout.write(`\n[LDRS DEVELOPMENT COLLECTION CODE] match ${args.match_id}: ${code} (${EXPIRY_MINUTES} minutes, no SMS sent)\n`);
    return value;
  }
  if (name === 'completeHandover') {
    need(process.env.LDRS_DEMO_OTP === '1', 'Secure collection delivery is not configured.', 503);
    const reference = trim(args.reference_code, 80).toUpperCase();
    const number = normalized(args.document_number);
    const providedCode = trim(args.otp, 20);
    const collector = trim(args.released_to, 120);
    const idType = trim(args.claimant_id_type, 40);
    const idNumber = trim(args.claimant_id_number, 100);
    const notes = trim(args.notes, 500);
    need(args.physical_id_checked === true, 'The officer must confirm the physical ID check.');
    need(collector.length >= 3, 'Enter the claimant name.');
    need(TYPES.has(idType), 'Choose a valid identity document type.');
    need(idNumber.length >= 4, 'Enter the ID number shown by the claimant.');
    need(/^\d{6}$/.test(providedCode), 'Enter the six-digit collection code.');
    const client = await pool.connect(); let committed = false;
    try {
      await client.query('BEGIN');
      const match = await findAuthorizedMatch(client, user, args.match_id, true);
      requireCollectible(match);
      need(reference && constantEqual(reference, String(match.reference_code||'').toUpperCase()), 'Reference code does not match.', 422);
      need(number && constantEqual(number, normalized(match.document_number)), 'Document number does not match.', 422);
      const { rows } = await client.query(`SELECT * FROM ldrs_v6.otp_codes
        WHERE match_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`, [match.id]);
      const otp = rows[0];
      need(otp, 'Create a collection code first.');
      need(!otp.used && !otp.locked && otp.attempts < MAX_ATTEMPTS,
        'Collection code is blocked or used. Create a new one.');
      need(new Date(otp.expires_at) > new Date(), 'Collection code expired. Create a new one.');
      const correct = constantEqual(digestCode(secretKey(),otp.id,providedCode), otp.otp_hash);
      if (!correct) {
        const attempts = Number(otp.attempts) + 1;
        const locked = attempts >= MAX_ATTEMPTS;
        await client.query(`UPDATE ldrs_v6.otp_codes SET attempts=$1,locked=$2,used=$2 WHERE id=$3`, [attempts,locked,otp.id]);
        await audit(user.id, 'collection_code_invalid', `Invalid collection code; attempt ${attempts} of ${MAX_ATTEMPTS}`, role, client);
        await client.query('COMMIT'); committed = true;
        fail(422, locked ? 'Too many incorrect codes. Create a new one.' :
          `Incorrect code. ${MAX_ATTEMPTS-attempts} attempt(s) left.`);
      }
      const old = await client.query(`SELECT id FROM ldrs_v6.handovers WHERE document_id=$1 LIMIT 1`, [match.document_id]);
      need(!old.rows.length, 'Document has already been released.', 409);
      const record = {
        id: crypto.randomUUID(), document_id: match.document_id, match_id: match.id,
        officer_user_id: user.id, released_to: collector, claimant_id_type: idType,
        claimant_id_number: idNumber, pickup_point_id: match.pickup_point_id,
        created_at: new Date().toISOString(),
      };
      const hash = receiptDigest(secretKey(), record);
      await client.query(`INSERT INTO ldrs_v6.handovers
        (id,document_id,match_id,officer_user_id,released_to,claimant_id_type,
        claimant_id_number,verification_method,notes,pickup_point_id,integrity_hash,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [record.id,record.document_id,record.match_id,record.officer_user_id,record.released_to,
          record.claimant_id_type,record.claimant_id_number,
          'Officer attested physical ID, reference code, document number and one-time collection code',
          notes,record.pickup_point_id,hash,record.created_at]);
      await client.query(`UPDATE ldrs_v6.documents SET status='Returned',returned_at=now(),updated_at=now() WHERE id=$1`, [match.document_id]);
      await client.query(`UPDATE ldrs_v6.matches SET match_status='Returned',updated_at=now() WHERE id=$1`, [match.id]);
      await client.query(`UPDATE ldrs_v6.matches SET match_status='Rejected',updated_at=now()
        WHERE document_id=$1 AND id<>$2 AND match_status IN ('Pending','Confirmed')`, [match.document_id,match.id]);
      if (match.loss_report_id) await client.query(`UPDATE ldrs_v6.loss_reports SET status='Closed',updated_at=now() WHERE id=$1`, [match.loss_report_id]);
      await client.query(`UPDATE ldrs_v6.otp_codes SET used=true WHERE id=$1`, [otp.id]);
      await audit(user.id,'handover_completed',`Document ${match.document_id} released via match ${match.id}`,role,client);
      await client.query('COMMIT'); committed=true;
      return { id: record.id };
    } catch (e) { if (!committed) await client.query('ROLLBACK').catch(()=>{}); throw e; }
    finally { client.release(); }
  }
  fail(501, `Unknown collection workflow: ${name}`);
}

export async function verifyPublicReceipt(pool, handoverId, hashPrefix) {
  if (!UUID.test(String(handoverId||'')) || !/^[0-9a-f]{16}$/i.test(String(hashPrefix||''))) return { valid: false };
  const {rows}=await pool.query(`SELECT h.*, d.document_type,p.name AS pickup_point
    FROM ldrs_v6.handovers h JOIN ldrs_v6.documents d ON d.id=h.document_id
    LEFT JOIN ldrs_v6.pickup_points p ON p.id=h.pickup_point_id WHERE h.id=$1`,[handoverId]);
  const record=rows[0];
  if (!record) return { valid:false };
  const expected = receiptDigest(secretKey(),record);
  if (!constantEqual(expected,record.integrity_hash||'') || !constantEqual(hashPrefix.toLowerCase(),expected.slice(0,16))) return {valid:false};
  return { valid:true, receipt_number: record.id.slice(0,8).toUpperCase(), document_type:record.document_type,
    released_at:record.created_at, pickup_point:record.pickup_point||'Pickup point' };
}
