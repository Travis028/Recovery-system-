/** No credentials and no writes: safe HTTP checks against the RUNNING LDRS v6 backend.
 * Usage: npm run smoke              (backend direct, port 4001)
 *        npm run smoke -- http://127.0.0.1:5175   (through the frontend dev proxy)
 */
const url = process.argv[2] || 'http://127.0.0.1:4001';
let failed = false;
for (const [endpoint, expected] of [
  ['/api/v6/health', 200],
  ['/api/v6/pickup-points', 200],
  ['/api/v6/auth/me', 401],
  ['/api/v6/admin/officers', 401],
]) {
  try {
    const res = await fetch(url + endpoint, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    const body = await res.json();
    const good = res.status === expected && (endpoint !== '/api/v6/health' || body.schema === 'ldrs_v6');
    console.log(`${good ? 'PASS' : 'FAIL'} ${res.status} ${endpoint}${good ? '' : ' (expected ' + expected + ')'}`);
    if (!good) failed = true;
  } catch (error) {
    console.log(`FAIL ${endpoint}: ${error.message} — is the backend running (npm start)?`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log(`PASS: LDRS v6 smoke checks against ${url}`);
