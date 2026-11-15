/** LDRS v6 backend — localhost-only API on PostgreSQL.
 * Routes live under /api/v6. All data is in the database schema "ldrs_v6".
 * The old pilot tables in public.* are never written.
 * Do not deploy this development configuration publicly.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { recordsRoute, ensureDefaultSettings } from './records.mjs';
import { appendAudit } from './auditChain.mjs';
import { verifyPublicReceipt } from './handover.mjs';
import {
  fail, required, validateEmail, validatePublicRole, passwordRules,
  createPassword, verifyPassword, safeUser, sha256, randomToken,
  otpDigest, cookieFor, emptyCookie, extractToken,
} from './security.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dotenv = path.join(here, '.env');
if (fs.existsSync(dotenv)) {
  for (const entry of fs.readFileSync(dotenv, 'utf8').split(/\r?\n/)) {
    const match = entry.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4001);
if (HOST !== '127.0.0.1') throw Error('LDRS v6 development backend must bind to 127.0.0.1 (local tests only).');
if (!process.env.DATABASE_URL) throw Error('backend/.env must define DATABASE_URL (copy .env.example to .env).');
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw Error('Invalid PORT.');
const appOrigins = new Set((process.env.APP_ORIGINS || 'http://127.0.0.1:5175,http://localhost:5175').split(',').map(s => s.trim()));
const devOtp = process.env.LDRS_DEMO_OTP === '1';
const cookieSecure = process.env.COOKIE_SECURE === '1';
const secret = process.env.LDRS_OTP_SECRET || crypto.randomBytes(32).toString('hex');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

function respond(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(JSON.stringify(data));
}
async function jsonBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'Send application/json.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) fail(413, 'Request body exceeds 32 KB.');
    chunks.push(chunk);
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'Invalid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'JSON object expected.');
  return parsed;
}
function checkOrigin(req) {
  if (['GET', 'HEAD'].includes(req.method)) return;
  const origin = req.headers.origin;
  if (origin && !appOrigins.has(origin)) fail(403, 'Origin not allowed.');
  // No CORS response; browser requests must use same-origin Vite proxy.
}
async function audit(userId, action, details, actorRole = null, query = pool) {
  await appendAudit(query, pool, { userId, action, details, actorRole }); // hash-chained (auditChain.mjs)
}
async function loadActor(req) {
  const token = extractToken(req.headers.cookie);
  if (!token) fail(401, 'Please log in.');
  const { rows } = await pool.query(`SELECT u.id,u.email,u.full_name,u.phone,u.phone_verified,
    u.role,u.ldrs_role,u.approved,u.pickup_point_id,u.language,u.disabled,u.created_at
    FROM ldrs_v6.sessions s JOIN ldrs_v6.users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1`, [sha256(token)]);
  if (!rows.length || rows[0].disabled) fail(401, 'Your session has expired or been revoked.');
  return rows[0];
}
function requireRole(user, role) {
  if (role === 'Admin') {
    if (user.role !== 'admin') fail(403, 'Administrator account required.');
  } else if (user.ldrs_role !== role || user.role !== 'user') {
    fail(403, `${role} account required.`);
  }
}
async function startSession(user, res, label = 'login') {
  const token = randomToken();
  await pool.query(`INSERT INTO ldrs_v6.sessions(token_hash,user_id,expires_at)
    VALUES($1,$2,now()+interval '8 hours')`, [sha256(token), user.id]);
  await audit(user.id, label, 'Server-side session created', user.role === 'admin' ? 'Admin' : user.ldrs_role);
  respond(res, 200, { status: 'ok', user: safeUser(user) }, { 'Set-Cookie': cookieFor(token, cookieSecure) });
}
async function challengeFor(user, purpose) {
  if (!devOtp) fail(503, 'SMS provider not configured; privileged authentication is unavailable.');
  const challengeId = randomToken();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(`INSERT INTO ldrs_v6.challenges(id,challenge_id,user_id,purpose,phone,code_hash,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,now()+interval '5 minutes')`,
    [crypto.randomUUID(), challengeId, user.id, purpose, user.phone || null, otpDigest(secret, challengeId, code)]);
  // Development-only delivery; never return code to the browser or persist plaintext.
  process.stdout.write(`\n[LDRS DEVELOPMENT OTP] ${purpose} for ${user.email}: ${code} (expires in five minutes)\n`);
  const tail = String(user.phone || '').replace(/\D/g, '').slice(-2);
  return { status: 'two_step', challenge_id: challengeId, phone_hint: tail ? `***${tail}` : 'local development terminal' };
}
async function redeemChallenge(challengeId, code, purpose) {
  if (!/^[0-9]{6}$/.test(String(code || ''))) fail(422, 'Enter the six-digit code.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT c.*,u.*,
      c.id AS challenge_record_id,c.attempts AS challenge_attempts,c.used AS challenge_used,c.phone AS challenge_phone
      FROM ldrs_v6.challenges c JOIN ldrs_v6.users u ON u.id=c.user_id
      WHERE c.challenge_id=$1 AND c.purpose=$2 FOR UPDATE OF c`, [challengeId, purpose]);
    const row = rows[0];
    if (!row || row.challenge_used || row.challenge_attempts >= 3 || new Date(row.expires_at) <= new Date()) {
      fail(422, 'Code expired or invalid. Please start again.');
    }
    const expected = otpDigest(secret, challengeId, code);
    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(row.code_hash, 'hex'));
    if (!valid) {
      await client.query(`UPDATE ldrs_v6.challenges SET attempts=attempts+1, used=(attempts+1>=3)
        WHERE id=$1`, [row.challenge_record_id]);
      await client.query('COMMIT');
      fail(422, 'Invalid code.');
    }
    await client.query('UPDATE ldrs_v6.challenges SET used=true WHERE id=$1', [row.challenge_record_id]);
    await client.query('COMMIT');
    return row;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be closed */ }
    throw err;
  } finally { client.release(); }
}

async function route(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const p = url.pathname;
  if (!p.startsWith('/api/v6/')) fail(404, 'Not found.');
  checkOrigin(req);
  const publicReceipt = p.match(/^\/api\/v6\/public\/receipts\/([0-9a-f-]{36})$/i);
  if (req.method === 'GET' && publicReceipt) return respond(res, 200, await verifyPublicReceipt(pool, publicReceipt[1], url.searchParams.get('h') || ''));
  if (req.method === 'GET' && p === '/api/v6/health') {
    const result = await pool.query(`SELECT count(*)::int AS users FROM ldrs_v6.users`);
    return respond(res, 200, { status: 'ok', version: 'v6', database: 'postgresql', schema: 'ldrs_v6', registered_users: result.rows[0].users });
  }
  if (req.method === 'GET' && p === '/api/v6/pickup-points') {
    const result = await pool.query(`SELECT id,name,point_type,location,county,contact_phone,active,verified
      FROM ldrs_v6.pickup_points WHERE active=true AND verified=true ORDER BY name`);
    return respond(res, 200, { items: result.rows });
  }
  if (req.method === 'POST' && p === '/api/v6/auth/register') {
    const x = await jsonBody(req);
    const email = validateEmail(x.email);
    const fullName = required(x.full_name, 'Full name', 120);
    if (fullName.length < 3) fail(422, 'Enter your full name.');
    const role = validatePublicRole(x.ldrs_role);
    const { hash, salt } = createPassword(x.password);
    let pointId = null;
    if (role === 'Officer') {
      pointId = required(x.pickup_point_id, 'Pickup point ID', 40);
      const point = await pool.query(`SELECT id FROM ldrs_v6.pickup_points WHERE id=$1 AND verified=true AND active=true`, [pointId]);
      if (!point.rows.length) fail(422, 'Choose an active verified pickup point.');
      if (!x.phone) fail(422, 'Officers must provide a phone number.');
    }
    const phone = x.phone ? required(x.phone, 'Phone', 30) : null;
    if (phone && !/^(?:\+254|0)7\d{8}$/.test(phone.replace(/[\s-]/g, ''))) fail(422, 'Enter a Kenyan mobile number.');
    const id = crypto.randomUUID();
    try {
      await pool.query(`INSERT INTO ldrs_v6.users
        (id,email,full_name,phone,phone_verified,role,ldrs_role,approved,pickup_point_id,password_hash,password_salt,language)
        VALUES($1,$2,$3,$4,false,'user',$5,false,$6,$7,$8,$9)`,
        [id,email,fullName,phone,role,pointId,hash,salt,x.language === 'sw' ? 'sw' : 'en']);
    } catch (err) {
      if (err.code === '23505') fail(409, 'An account with this email already exists.');
      throw err;
    }
    await audit(id, 'register', 'Public account registration', role);
    return respond(res, 201, { status: 'ok', needs_approval: role === 'Officer' });
  }
  if (req.method === 'POST' && p === '/api/v6/auth/login') {
    const { email: rawEmail, password } = await jsonBody(req);
    const email = validateEmail(rawEmail);
    const { rows } = await pool.query('SELECT * FROM ldrs_v6.users WHERE lower(email)=$1', [email]);
    const user = rows[0];
    const locked = user?.locked_until && new Date(user.locked_until) > new Date();
    if (locked) fail(423, 'Account temporarily locked. Try again later.');
    const valid = verifyPassword(password, user?.password_salt, user?.password_hash);
    if (!user || !valid) {
      if (user) await pool.query(`UPDATE ldrs_v6.users SET failed_logins=failed_logins+1,
        locked_until=CASE WHEN failed_logins+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END,
        updated_at=now() WHERE id=$1`, [user.id]);
      fail(401, 'Email or password is wrong.');
    }
    if (user.disabled) fail(403, 'This account is disabled.');
    await pool.query(`UPDATE ldrs_v6.users SET failed_logins=0,locked_until=NULL,updated_at=now() WHERE id=$1`, [user.id]);
    // Unapproved officers have no access to privileged station functions.
    // They may sign in to see application status, without elevated authority.
    if (user.role === 'admin' || (user.ldrs_role === 'Officer' && user.approved)) {
      const challenge = await challengeFor(user, 'login');
      await audit(user.id, 'login_challenge', 'Privileged second step issued', user.role === 'admin' ? 'Admin' : 'Officer');
      return respond(res, 200, challenge);
    }
    return startSession(user, res);
  }
  if (req.method === 'POST' && p === '/api/v6/auth/verify-two-step') {
    const x = await jsonBody(req);
    const user = await redeemChallenge(required(x.challenge_id, 'Challenge ID', 100), x.code, 'login');
    if (user.disabled) fail(403, 'Account disabled.');
    if (user.ldrs_role === 'Officer' && !user.approved) fail(403, 'Officer approval required.');
    return startSession(user, res, 'login_two_step');
  }
  if (req.method === 'POST' && p === '/api/v6/auth/request-reset') {
    const { email: rawEmail } = await jsonBody(req);
    const email = validateEmail(rawEmail);
    const { rows } = await pool.query(`SELECT id,email,phone FROM ldrs_v6.users WHERE lower(email)=$1 AND disabled=false`, [email]);
    const user = rows[0];
    // Equal-looking response when user doesn't exist. No email enumeration.
    const challenge = user && devOtp ? await challengeFor(user, 'reset') : { challenge_id: randomToken() };
    return respond(res, 200, { challenge_id: challenge.challenge_id || randomToken() });
  }
  if (req.method === 'POST' && p === '/api/v6/auth/reset-password') {
    const x = await jsonBody(req);
    const { hash, salt } = createPassword(x.password);
    const user = await redeemChallenge(required(x.challenge_id, 'Challenge ID', 100), x.code, 'reset');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE ldrs_v6.users SET password_hash=$1,password_salt=$2,failed_logins=0,locked_until=NULL,updated_at=now() WHERE id=$3`, [hash,salt,user.id]);
      await client.query('DELETE FROM ldrs_v6.sessions WHERE user_id=$1', [user.id]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
    await audit(user.id, 'password_reset', 'All sessions revoked', user.role === 'admin' ? 'Admin' : user.ldrs_role);
    return respond(res, 200, { status: 'ok' });
  }
  if (req.method === 'POST' && p === '/api/v6/auth/logout') {
    const token = extractToken(req.headers.cookie);
    if (token) {
      const { rows } = await pool.query(`DELETE FROM ldrs_v6.sessions s USING ldrs_v6.users u
        WHERE s.token_hash=$1 AND u.id=s.user_id RETURNING s.user_id, u.role, u.ldrs_role`, [sha256(token)]);
      if (rows.length) await audit(rows[0].user_id, 'logout', 'Session revoked', rows[0].role === 'admin' ? 'Admin' : rows[0].ldrs_role);
    }
    return respond(res, 200, { status: 'ok' }, { 'Set-Cookie': emptyCookie(cookieSecure) });
  }

  // Everything below this point requires a real server-side session.
  const user = await loadActor(req);
  if (await recordsRoute({pool,user,respond,jsonBody,audit,challengeFor,redeemChallenge},req,res,url)) return;
  if (req.method === 'GET' && p === '/api/v6/auth/me') return respond(res, 200, safeUser(user));
  if (req.method === 'PATCH' && p === '/api/v6/auth/me') {
    const x = await jsonBody(req);
    const name = x.full_name === undefined ? user.full_name : required(x.full_name, 'Full name', 120);
    const language = x.language === 'sw' ? 'sw' : 'en';
    const result = await pool.query(`UPDATE ldrs_v6.users SET full_name=$1,language=$2,updated_at=now() WHERE id=$3 RETURNING *`,[name,language,user.id]);
    return respond(res, 200, safeUser(result.rows[0]));
  }
  if (req.method === 'GET' && p === '/api/v6/auth/session-check') {
    return respond(res, 200, { authenticated: true, role: user.role === 'admin' ? 'Admin' : user.ldrs_role, approved: user.approved });
  }
  if (p.startsWith('/api/v6/admin/')) {
    requireRole(user, 'Admin');
    if (req.method === 'GET' && p === '/api/v6/admin/officers') {
      const result = await pool.query(`SELECT id,full_name,email,ldrs_role,approved,pickup_point_id,created_at
        FROM ldrs_v6.users WHERE ldrs_role='Officer' ORDER BY created_at DESC LIMIT 100`);
      return respond(res, 200, { items: result.rows });
    }
    const match = p.match(/^\/api\/v6\/admin\/officers\/([a-f0-9-]{36})\/approve$/);
    if (req.method === 'POST' && match) {
      const x = await jsonBody(req);
      if (typeof x.approved !== 'boolean') fail(422, 'approved must be true or false.');
      const result = await pool.query(`UPDATE ldrs_v6.users SET approved=$1,updated_at=now()
        WHERE id=$2 AND ldrs_role='Officer' RETURNING id,email,approved,pickup_point_id`, [x.approved,match[1]]);
      if (!result.rows.length) fail(404, 'Officer not found.');
      await audit(user.id, 'officer_approval', `${match[1]}: ${x.approved}`, 'Admin');
      return respond(res, 200, { officer: result.rows[0] });
    }
    fail(404, 'Unknown administrator endpoint.');
  }
  if (req.method === 'GET' && p === '/api/v6/officer/context') {
    requireRole(user, 'Officer');
    if (!user.approved || !user.pickup_point_id) fail(403, 'Officer account is awaiting administrator approval.');
    const point = await pool.query(`SELECT id,name,county FROM ldrs_v6.pickup_points WHERE id=$1 AND active=true AND verified=true`, [user.pickup_point_id]);
    if (!point.rows.length) fail(403, 'Officer pickup point is not active and verified.');
    return respond(res, 200, { officer: safeUser(user), pickup_point: point.rows[0] });
  }
  fail(404, 'Unknown endpoint.');
}

const server = http.createServer(async (req, res) => {
  try { await route(req, res); }
  catch (error) {
    if (!error.status) console.error('[LDRS v6 backend]', error);
    respond(res, error.status || 500, { error: error.status ? error.message : 'Internal server error.' });
  }
});
try {
  const res = await pool.query(`SELECT to_regclass('ldrs_v6.users') AS users, to_regclass('ldrs_v6.sessions') AS sessions`);
  if (!res.rows[0].users || !res.rows[0].sessions) throw Error('Schema ldrs_v6 is missing. See database/README.md (migration 001).');
  const pending = (await pool.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='ldrs_v6' AND table_name='documents' AND column_name='county'`)).rows[0].n === 0;
  if (pending) { console.error('Database needs an update (migration 002: location fields). Run:  npm run migrate'); process.exit(1); }
  await ensureDefaultSettings(pool); // adds any missing setting with its default; never overwrites saved values
} catch (error) {
  console.error('Unable to connect to PostgreSQL (schema ldrs_v6):', error.message);
  console.error('Check: Docker PostgreSQL is running on 127.0.0.1:5433, and DATABASE_URL in backend/.env is correct.');
  process.exit(1);
}
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Stop the other backend first.` : error.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`LDRS v6 backend: http://${HOST}:${PORT}/api/v6/health`);
  console.log(`DB schema: ldrs_v6; development OTP: ${devOtp ? 'enabled (terminal only)' : 'DISABLED'}`);
});
