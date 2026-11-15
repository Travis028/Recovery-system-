/** LDRS v6: server-owned authentication (HttpOnly cookie session in PostgreSQL).
 * Active when VITE_LDRS_AUTH_MODE=server — set by frontend/.env.server, which
 * `npm run dev` and `npm run build` load. `npm run dev:demo` runs the browser-only demo instead.
 */
export const serverAuthEnabled = import.meta.env.VITE_LDRS_AUTH_MODE === 'server';
let cachedActor = null;

export function serverActor() { return cachedActor; }
async function request(route, method = 'GET', data) {
  let response;
  try {
    response = await fetch('/api/v6/' + route, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    const err = new Error('Cannot reach the LDRS v6 backend (port 4001). Is it running?');
    err.status = 503;
    throw err;
  }
  let body = {};
  try { body = await response.json(); } catch { /* no or invalid JSON */ }
  if (!response.ok) {
    const err = new Error(body.error || 'Request failed (' + response.status + ').');
    err.status = response.status;
    throw err;
  }
  return body;
}
export function serverPickupPoints() {
  return request('pickup-points').then(value => value.items);
}
export const serverAuth = {
  async me() {
    try {
      cachedActor = await request('auth/me');
      return cachedActor;
    } catch (err) {
      if (err.status === 401) cachedActor = null;
      throw err;
    }
  },
  async login({ email, password }) {
    const result = await request('auth/login', 'POST', { email, password });
    if (result.status === 'ok') cachedActor = result.user;
    return result;
  },
  async verifyTwoStep({ challenge_id, code }) {
    const result = await request('auth/verify-two-step', 'POST', { challenge_id, code });
    if (result.status === 'ok') cachedActor = result.user;
    return result;
  },
  register(value) { return request('auth/register', 'POST', value); },
  requestPasswordReset({ email }) { return request('auth/request-reset', 'POST', { email }); },
  resetPassword({ challenge_id, code, password }) { return request('auth/reset-password', 'POST', { challenge_id, code, password }); },
  async updateMe(value) {
    cachedActor = await request('auth/me', 'PATCH', value);
    return cachedActor;
  },
  async logout(redirectTo) {
    try { await request('auth/logout', 'POST', {}); }
    finally {
      cachedActor = null;
      if (redirectTo) window.location.assign(redirectTo);
    }
  },
  isAuthenticated() { return cachedActor !== null; },
};
