/** Read-only PostgreSQL connection check. Writes nothing.
 * Usage (from backend/): npm run check:db
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envFile = path.join(root, '.env');
if (!fs.existsSync(envFile)) { console.error('FAIL: backend/.env not found. Copy .env.example to .env first.'); process.exit(1); }
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const safeUrl = String(process.env.DATABASE_URL || '').replace(/\/\/([^:]+):.*@([^@]+)$/, '//$1:****@$2');
console.log('Connecting to', safeUrl);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const v = await client.query('SELECT current_database() AS db, current_user AS usr, version() AS v');
  console.log(`PASS connected: database=${v.rows[0].db} user=${v.rows[0].usr}`);
  console.log('     ' + v.rows[0].v.split(',')[0]);
  const t = await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='ldrs_v6' AND table_type='BASE TABLE'`);
  console.log(`${t.rows[0].n === 17 ? 'PASS' : 'WARN'} ldrs_v6 tables: ${t.rows[0].n} (expected 17)`);
  const counts = await client.query(`SELECT 'users' AS t, count(*)::int AS n FROM ldrs_v6.users
    UNION ALL SELECT 'pickup_points', count(*) FROM ldrs_v6.pickup_points
    UNION ALL SELECT 'documents', count(*) FROM ldrs_v6.documents
    UNION ALL SELECT 'loss_reports', count(*) FROM ldrs_v6.loss_reports
    UNION ALL SELECT 'matches', count(*) FROM ldrs_v6.matches
    UNION ALL SELECT 'claims', count(*) FROM ldrs_v6.claims
    UNION ALL SELECT 'handovers', count(*) FROM ldrs_v6.handovers
    UNION ALL SELECT 'uploads', count(*) FROM ldrs_v6.uploads`);
  for (const r of counts.rows) console.log(`     ${r.t.padEnd(14)} ${r.n}`);
  const up = await client.query(`SELECT id FROM ldrs_v6.uploads`);
  const missing = up.rows.filter(r => !fs.existsSync(path.join(root, '.private-document-photos', r.id + '.bin')));
  console.log(`${missing.length ? 'WARN' : 'PASS'} encrypted photo files present for ${up.rows.length - missing.length}/${up.rows.length} uploads`);
  if (up.rows.length && !fs.existsSync(path.join(root, '.private-photo-key'))) console.log('WARN .private-photo-key is missing — existing photos cannot be decrypted.');
} catch (error) {
  console.error('FAIL:', error.message);
  console.error('Check: Docker PostgreSQL is running (docker compose ps in your PostgreSQL folder) on 127.0.0.1:5433.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
