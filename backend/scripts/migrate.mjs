/** Apply database migrations that are not yet recorded in ldrs_v6.schema_migrations.
 * Usage (from backend/):  npm run migrate            apply pending migrations
 *                         npm run migrate -- --status   only list applied / pending
 * Each file in database/migrations/ is applied once, in name order, inside its own transaction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, '..', 'database', 'migrations');
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const statusOnly = process.argv.includes('--status');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const ledger = (await client.query(`SELECT to_regclass('ldrs_v6.schema_migrations') AS t`)).rows[0].t;
  const applied = new Set(ledger ? (await client.query('SELECT version FROM ldrs_v6.schema_migrations')).rows.map(r => r.version) : []);
  const files = fs.readdirSync(dir).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
  let ran = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) { console.log(`applied  ${version}`); continue; }
    if (statusOnly) { console.log(`PENDING  ${version}`); continue; }
    process.stdout.write(`applying ${version} ... `);
    try { await client.query(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    const ok = (await client.query('SELECT 1 FROM ldrs_v6.schema_migrations WHERE version=$1', [version])).rows.length;
    if (!ok) throw Error(`${file} ran but did not record itself in ldrs_v6.schema_migrations.`);
    console.log('done'); ran += 1;
  }
  if (!statusOnly) console.log(ran ? `PASS ${ran} migration(s) applied.` : 'PASS database is up to date.');
} catch (error) {
  console.error('\nFAIL:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
