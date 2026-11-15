/** One-time fixture accounts for a LOCAL, EMPTY ldrs_v6 schema only.
 * This script never modifies the old pilot tables in public.* and refuses to run twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createPassword } from '../security.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envFile = path.join(root, '.env');
if (!fs.existsSync(envFile)) throw Error('Create backend/.env before running the development seed.');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const matched = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (matched && !process.env[matched[1]]) process.env[matched[1]] = matched[2];
}
if (process.env.LDRS_DEV_SEED !== '1' || process.env.HOST !== '127.0.0.1') {
  throw Error('Development seed is allowed only on localhost with LDRS_DEV_SEED=1.');
}
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  throw Error('For safety, development seeding requires local Docker PostgreSQL on 127.0.0.1:5433.');
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const count = await client.query('SELECT count(*)::int AS count FROM ldrs_v6.users');
  if (count.rows[0].count !== 0) throw Error('ldrs_v6 already has users. Seed intentionally refuses to overwrite or duplicate accounts.');
  const pointId = crypto.randomUUID();
  await client.query(`INSERT INTO ldrs_v6.pickup_points
    (id,name,point_type,location,county,contact_phone,verified,active)
    VALUES($1,'Kisumu Central — Demo Station','Police station','Kisumu (fictional test location)','Kisumu','0710000099',true,true)`,[pointId]);
  const accounts = [
    { role: 'admin', ldrs_role: null, name: 'Demo LDRS Administrator', email: 'admin@ldrs.test' },
    { role: 'user', ldrs_role: 'Officer', name: 'Demo LDRS Officer', email: 'officer@ldrs.test' },
    { role: 'user', ldrs_role: 'Owner', name: 'Demo LDRS Owner', email: 'owner@ldrs.test' },
    { role: 'user', ldrs_role: 'Finder', name: 'Demo LDRS Finder', email: 'finder@ldrs.test' },
  ];
  const credentials = [];
  for (const account of accounts) {
    const password = crypto.randomBytes(16).toString('base64url') + 'aA1';
    const secret = createPassword(password);
    const id = crypto.randomUUID();
    await client.query(`INSERT INTO ldrs_v6.users
      (id,email,full_name,phone,phone_verified,role,ldrs_role,approved,pickup_point_id,password_hash,password_salt)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id,account.email,account.name,'0710000099',true,account.role,account.ldrs_role,
        account.role === 'admin' || account.ldrs_role === 'Officer',account.ldrs_role === 'Officer' ? pointId : null,
        secret.hash,secret.salt]);
    credentials.push({role: account.ldrs_role || 'Admin', email: account.email, password});
  }
  await client.query('COMMIT');
  console.log('\nLOCAL DEVELOPMENT CREDENTIALS — fictional accounts only.');
  console.log('Copy these into a PRIVATE password manager. They are not stored in plaintext by the server.');
  for (const account of credentials) console.log(`${account.role.padEnd(8)} ${account.email.padEnd(23)} ${account.password}`);
  console.log('\nAdmin and Officer also require a one-time code printed in the backend terminal.');
  console.log('DO NOT publish this terminal output or use these accounts for real data.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Seed cancelled:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
