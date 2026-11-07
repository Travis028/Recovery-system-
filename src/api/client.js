/**
 * The API the screens talk to: `api.entities.X.filter(...)`, `api.auth.me()`,
 * `api.functions.invoke(name, args)` and `api.integrations.Core` for private files. The call
 * shapes follow the Base44 SDK the first version was written for.
 *
 * It behaves like a small server: every call is checked against the signed-in user's role (api/permissions.js),
 * passwords are hashed, accounts lock after repeated failures, officers and admins use a
 * second login step, images are encrypted, and the audit trail is append-only and hash-linked.
 *
 * Everything still runs in the browser, so it is a demonstration of the rules, not a
 * substitute for the real server (see README.md, "Moving to production").
 */
import {
  ApiError,
  findById,
  insert,
  matches,
  patch,
  remove,
  sortRows,
  table,
  transaction,
} from './db';
import { can, shape, roleOf, SYSTEM } from './permissions';
import { appendAudit, listAudit } from './auditStore';
import { getPrivateFile, putPrivateFile } from './fileStore';
import { randomDigits, randomHex, sha256Hex, hashPassword, verifyPassword, passwordProblems } from './crypto';
import { FUNCTIONS } from './functions';
import { ensureSeeded } from './seed';
import { deliverSms } from '@/lib/sms';
import { isValidKenyanPhone, normalizePhone, maskPhone } from '@/lib/ldrs';

const SESSION_KEY = 'ldrs.session';
const SESSION_HOURS = 8;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const TWO_STEP_MINUTES = 5;
const TWO_STEP_ATTEMPTS = 3;

// markUnclaimed changes records without a role check (it runs at start-up); notifyOwner sends
// any text to any user. Screens use the narrower functions built on them instead.
const INTERNAL_FUNCTIONS = ['markUnclaimed', 'notifyOwner'];

/* ---------- Sessions ---------- */

function readSessionToken() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw).token : null;
  } catch (error) {
    return null;
  }
}

export function currentActor() {
  const token = readSessionToken();
  if (!token) return null;
  const session = table('Session').find(function (row) {
    return row.token === token;
  });
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;
  const user = findById('User', session.user_id);
  if (!user || user.disabled) return null;
  return user;
}

function startSession(user) {
  const token = randomHex(32);
  insert('Session', {
    token,
    user_id: user.id,
    expires_at: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
  });
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token }));
}

function endSession() {
  const token = readSessionToken();
  if (token) {
    table('Session')
      .filter(function (row) {
        return row.token === token;
      })
      .forEach(function (row) {
        remove('Session', row.id);
      });
  }
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('ldrs-session-logged');
}

export function revokeSessionsFor(userId) {
  table('Session')
    .filter(function (row) {
      return row.user_id === userId;
    })
    .forEach(function (row) {
      remove('Session', row.id);
    });
}

/* ---------- Result lists ---------- */

// Lists are plain arrays; .total carries the count before skip and limit were applied.
function page(rows, total) {
  const list = rows.slice();
  list.total = total === undefined ? rows.length : total;
  return list;
}

function requireActor(getActor) {
  const actor = getActor();
  if (!actor) {
    // Lets the app send the user to sign-in when a session expires or is revoked mid-use.
    window.dispatchEvent(new CustomEvent('ldrs:session-ended'));
    throw new ApiError(401, 'Please sign in.');
  }
  return actor;
}

function makeEntity(name, getActor) {
  return {
    async filter(query, options) {
      const actor = requireActor(getActor);
      const opts = options || {};
      let rows = table(name).filter(function (row) {
        return matches(row, query || {}) && can('read', name, actor, row);
      });
      const total = rows.length;
      rows = sortRows(rows, opts.sort);
      if (opts.skip) rows = rows.slice(opts.skip);
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return page(
        rows.map(function (row) {
          return shape(name, actor, row);
        }),
        total,
      );
    },
    async list(sort, limit) {
      return this.filter({}, { sort, limit });
    },
    async get(id) {
      const actor = requireActor(getActor);
      const row = findById(name, id);
      if (!row || !can('read', name, actor, row)) throw new ApiError(404, name + ' not found.');
      return shape(name, actor, row);
    },
    async count(query) {
      const actor = requireActor(getActor);
      return table(name).filter(function (row) {
        return matches(row, query || {}) && can('read', name, actor, row);
      }).length;
    },
    async create(data) {
      const actor = requireActor(getActor);
      if (!can('create', name, actor, data || {})) {
        throw new ApiError(403, 'Your role is not allowed to create ' + name + ' records.');
      }
      return shape(name, actor, insert(name, data || {}, actor.id));
    },
    async update(id, changes) {
      const actor = requireActor(getActor);
      const row = findById(name, id);
      if (!row || !can('read', name, actor, row)) throw new ApiError(404, name + ' not found.');
      if (!can('update', name, actor, row, changes || {})) {
        throw new ApiError(403, 'Your role is not allowed to change this ' + name + ' record.');
      }
      return shape(name, actor, patch(name, id, changes || {}));
    },
    async delete(id) {
      const actor = requireActor(getActor);
      const row = findById(name, id);
      if (!row || !can('read', name, actor, row)) throw new ApiError(404, name + ' not found.');
      if (!can('remove', name, actor, row)) throw new ApiError(403, 'Your role is not allowed to delete this record.');
      remove(name, id);
    },
  };
}

/** The audit trail is append-only: create works for everyone, read for admins, nothing else. */
function makeAuditEntity(getActor) {
  const readAll = function (query, opts) {
    const actor = requireActor(getActor);
    const role = roleOf(actor);
    if (role !== 'Admin' && role !== 'System') throw new ApiError(403, 'Only administrators can read the audit trail.');
    let rows = listAudit().filter(function (row) {
      return matches(row, query || {});
    });
    const total = rows.length;
    rows = sortRows(rows, (opts && opts.sort) || '-seq');
    if (opts && opts.limit) rows = rows.slice(0, opts.limit);
    return page(rows, total);
  };
  return {
    async create(data) {
      const actor = getActor();
      return appendAudit({
        user_id: actor && !actor.__system ? actor.id : data.user_id || null,
        actor_role: roleOf(actor) || 'Anonymous',
        action: data.action,
        details: data.details,
      });
    },
    async filter(query, opts) {
      return readAll(query, opts);
    },
    async list(sort, limit) {
      return readAll({}, { sort, limit });
    },
    async count(query) {
      return readAll(query).length;
    },
    async get(id) {
      const found = readAll({ id })[0];
      if (!found) throw new ApiError(404, 'Audit entry not found.');
      return found;
    },
    async update() {
      throw new ApiError(403, 'Audit entries cannot be changed.');
    },
    async delete() {
      throw new ApiError(403, 'Audit entries cannot be deleted.');
    },
  };
}

/* ---------- Auth ---------- */

function audit(actor, action, details) {
  return appendAudit({
    user_id: actor && !actor.__system ? actor.id : null,
    actor_role: roleOf(actor) || 'Anonymous',
    action,
    details,
  });
}

function needsTwoStep(user) {
  return user.role === 'admin' || user.ldrs_role === 'Officer';
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return 'unknown';
  return local.slice(0, 2) + '***@' + domain;
}

async function createChallenge({ userId, purpose, phone, minutes }) {
  const code = randomDigits(6);
  const id = randomHex(12);
  insert('Challenge', {
    challenge_id: id,
    user_id: userId,
    purpose,
    phone: phone || '',
    code_hash: await sha256Hex(id + ':' + code),
    expires_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    attempts: 0,
    used: false,
  });
  return { id, code };
}

export async function checkChallenge({ challengeId, code, purpose, userId, maxAttempts }) {
  const row = table('Challenge').find(function (item) {
    return item.challenge_id === challengeId && item.purpose === purpose;
  });
  if (!row || row.used || (userId && row.user_id !== userId)) {
    throw new ApiError(422, 'This code is no longer valid. Request a new one.');
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    patch('Challenge', row.id, { used: true });
    throw new ApiError(422, 'This code has expired. Request a new one.');
  }
  const ok = (await sha256Hex(challengeId + ':' + String(code || '').trim())) === row.code_hash;
  if (!ok) {
    const attempts = row.attempts + 1;
    const locked = attempts >= maxAttempts;
    patch('Challenge', row.id, { attempts, used: locked });
    throw new ApiError(
      422,
      locked
        ? 'Too many wrong codes. This code is now blocked — start again.'
        : 'Wrong code. ' + (maxAttempts - attempts) + ' attempt(s) left.',
      { attemptsLeft: maxAttempts - attempts, locked },
    );
  }
  patch('Challenge', row.id, { used: true });
  return row;
}

export async function sendChallengeSms({ userId, purpose, phone, minutes, text }) {
  const challenge = await createChallenge({ userId, purpose, phone, minutes });
  await deliverSms({ to: phone, message: text(challenge.code) });
  return challenge.id;
}

function makeAuth(getActor) {
  return {
    async me() {
      await ensureSeeded();
      const actor = getActor();
      if (!actor) throw new ApiError(401, 'Not signed in.');
      return shape('User', actor, actor);
    },

    async login({ email, password }) {
      await ensureSeeded();
      const normalized = String(email || '').trim().toLowerCase();
      const user = table('User').find(function (row) {
        return row.email === normalized;
      });
      if (!user) {
        await hashPassword(String(password || ''), 'ab'.repeat(16)); // same work as a real check
        await audit(null, 'Failed login', 'Unknown account ' + maskEmail(normalized));
        throw new ApiError(401, 'Email or password is wrong.');
      }
      if (user.disabled) throw new ApiError(403, 'This account has been disabled. Contact the LDRS administrator.');
      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        await audit(user, 'Login blocked', 'Attempt on a locked account ' + maskEmail(normalized));
        throw new ApiError(423, 'This account is locked after repeated failed logins. Try again later or reset your password.');
      }
      const ok = await verifyPassword(String(password || ''), user.password_hash, user.password_salt);
      if (!ok) {
        const failed = (user.failed_logins || 0) + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        patch('User', user.id, {
          failed_logins: lock ? 0 : failed,
          locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() : user.locked_until || '',
        });
        await audit(user, 'Failed login', 'Wrong password for ' + maskEmail(normalized) + ' (' + failed + ' of ' + MAX_FAILED_LOGINS + ')');
        if (lock) await audit(user, 'Account locked', maskEmail(normalized) + ' locked for ' + LOCK_MINUTES + ' minutes');
        throw new ApiError(
          401,
          lock
            ? 'Too many failed attempts. The account is locked for ' + LOCK_MINUTES + ' minutes.'
            : 'Email or password is wrong. ' + (MAX_FAILED_LOGINS - failed) + ' attempt(s) left before the account locks.',
        );
      }
      patch('User', user.id, { failed_logins: 0, locked_until: '' });

      if (needsTwoStep(user)) {
        if (!user.phone || !user.phone_verified) {
          throw new ApiError(403, 'Two-step login needs a verified phone number. Ask the administrator to update your account.');
        }
        const challengeId = await sendChallengeSms({
          userId: user.id,
          purpose: 'login',
          phone: user.phone,
          minutes: TWO_STEP_MINUTES,
          text: function (code) {
            return 'LDRS: Your login code is ' + code + '. It expires in ' + TWO_STEP_MINUTES + ' minutes. Never share it with anyone.';
          },
        });
        return { status: 'two_step', challenge_id: challengeId, phone_hint: maskPhone(user.phone) };
      }

      startSession(user);
      await audit(user, 'Login', 'Signed in to LDRS');
      return { status: 'ok' };
    },

    async verifyTwoStep({ challenge_id, code }) {
      const row = await checkChallenge({
        challengeId: challenge_id,
        code,
        purpose: 'login',
        maxAttempts: TWO_STEP_ATTEMPTS,
      }).catch(async function (error) {
        await audit(null, 'Failed two-step login', error.message);
        throw error;
      });
      const user = findById('User', row.user_id);
      if (!user || user.disabled) throw new ApiError(403, 'This account cannot sign in.');
      startSession(user);
      await audit(user, 'Login', 'Signed in to LDRS with two-step login');
      return { status: 'ok' };
    },

    async register(data) {
      await ensureSeeded();
      const email = String(data.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(422, 'Enter a valid email address.');
      if (table('User').some(function (row) { return row.email === email; })) {
        throw new ApiError(409, 'An account with this email already exists.');
      }
      const fullName = String(data.full_name || '').trim();
      if (fullName.length < 3) throw new ApiError(422, 'Enter your full name.');
      const problems = passwordProblems(data.password);
      if (problems.length) throw new ApiError(422, 'Password needs ' + problems.join(', ') + '.');
      const ldrsRole = data.ldrs_role;
      if (['Finder', 'Owner', 'Officer'].indexOf(ldrsRole) < 0) throw new ApiError(422, 'Choose how you will use LDRS.');
      let phone = '';
      if (data.phone) {
        if (!isValidKenyanPhone(data.phone)) throw new ApiError(422, 'Enter a Kenyan phone number, for example 0712 345 678.');
        phone = normalizePhone(data.phone);
      }
      if (ldrsRole === 'Officer') {
        const point = findById('PickupPoint', data.pickup_point_id);
        if (!point || !point.active || !point.verified) throw new ApiError(422, 'Choose the verified pickup point you work at.');
        if (!phone) throw new ApiError(422, 'Officers need a phone number for two-step login.');
      }
      const { hash, salt } = await hashPassword(String(data.password));
      const user = insert('User', {
        email,
        full_name: fullName,
        phone,
        phone_verified: false,
        role: 'user',
        ldrs_role: ldrsRole,
        approved: false,
        pickup_point_id: ldrsRole === 'Officer' ? data.pickup_point_id : '',
        language: data.language === 'sw' ? 'sw' : 'en',
        password_hash: hash,
        password_salt: salt,
        failed_logins: 0,
      });
      await audit(user, 'Account registered', ldrsRole + ' account created for ' + maskEmail(email) + (ldrsRole === 'Officer' ? ' (awaiting approval)' : ''));
      return { status: 'ok', needs_approval: ldrsRole === 'Officer' };
    },

    async requestPasswordReset({ email }) {
      await ensureSeeded();
      const normalized = String(email || '').trim().toLowerCase();
      const user = table('User').find(function (row) {
        return row.email === normalized;
      });
      let challengeId = randomHex(12);
      if (user && user.phone) {
        challengeId = await sendChallengeSms({
          userId: user.id,
          purpose: 'reset',
          phone: user.phone,
          minutes: 15,
          text: function (code) {
            return 'LDRS: Your password reset code is ' + code + '. It expires in 15 minutes. If you did not ask for this, ignore this message.';
          },
        });
      }
      await audit(user || null, 'Password reset requested', maskEmail(normalized));
      // Same answer whether or not the account exists, so emails cannot be tested.
      return { challenge_id: challengeId };
    },

    async resetPassword({ challenge_id, code, password }) {
      const problems = passwordProblems(password);
      if (problems.length) throw new ApiError(422, 'Password needs ' + problems.join(', ') + '.');
      const row = await checkChallenge({ challengeId: challenge_id, code, purpose: 'reset', maxAttempts: 3 });
      const user = findById('User', row.user_id);
      if (!user) throw new ApiError(422, 'This code is no longer valid.');
      const { hash, salt } = await hashPassword(String(password));
      patch('User', user.id, { password_hash: hash, password_salt: salt, failed_logins: 0, locked_until: '' });
      revokeSessionsFor(user.id);
      await audit(user, 'Password reset', 'Password changed with a reset code; all sessions signed out');
      return { status: 'ok' };
    },

    async updateMe(changes) {
      const actor = requireActor(getActor);
      const allowed = {};
      if (changes.full_name !== undefined) allowed.full_name = String(changes.full_name).trim();
      if (changes.language !== undefined) allowed.language = changes.language === 'sw' ? 'sw' : 'en';
      return shape('User', actor, patch('User', actor.id, allowed));
    },

    async logout(redirectTo) {
      const actor = getActor();
      if (actor) await audit(actor, 'Logout', 'Signed out');
      endSession();
      if (redirectTo) window.location.assign(redirectTo);
    },

    isAuthenticated() {
      return Boolean(getActor());
    },
  };
}

/* ---------- Files ---------- */

function canViewImage(actor, fileUri) {
  const role = roleOf(actor);
  if (role === 'Admin' || role === 'System') return true;
  const upload = table('Upload').find(function (row) {
    return row.file_uri === fileUri;
  });
  if (upload && upload.uploaded_by === actor.id) return true;
  const doc = table('Document').find(function (row) {
    return row.image_url === fileUri;
  });
  if (!doc) return false;
  if (role === 'Officer') return doc.pickup_point_id === actor.pickup_point_id;
  if (role === 'Finder') return doc.finder_user_id === actor.id;
  return false; // owners never receive the stored photograph
}

function makeIntegrations(getActor) {
  return {
    Core: {
      async UploadPrivateFile({ file }) {
        const actor = requireActor(getActor);
        const role = roleOf(actor);
        if (['Finder', 'Officer', 'Admin', 'System'].indexOf(role) < 0) {
          throw new ApiError(403, 'Only finders and officers can upload photographs.');
        }
        if (!file || ['image/jpeg', 'image/png'].indexOf(file.type) < 0) {
          throw new ApiError(415, 'Only JPG or PNG photographs are accepted.');
        }
        if (file.size > 5 * 1024 * 1024) throw new ApiError(413, 'The photograph is larger than 5 MB.');
        const fileUri = await putPrivateFile(file, { uploaded_by: actor.id, uploaded_at: new Date().toISOString() });
        insert('Upload', { file_uri: fileUri, uploaded_by: actor.id }, actor.id);
        return { file_uri: fileUri };
      },
      async CreateFileSignedUrl({ file_uri }) {
        const actor = requireActor(getActor);
        if (!canViewImage(actor, file_uri)) throw new ApiError(403, 'You are not allowed to view this photograph.');
        const file = await getPrivateFile(file_uri);
        if (!file) throw new ApiError(404, 'Photograph not found.');
        return { signed_url: URL.createObjectURL(file.blob) };
      },
    },
  };
}

/* ---------- Client ---------- */

function createClient(getActor) {
  const entities = {};
  const client = { entities };
  ['Document', 'LossReport', 'Match', 'Notification', 'OtpCode', 'Claim', 'Handover', 'PickupPoint', 'User', 'DataRequest', 'Setting'].forEach(function (name) {
    entities[name] = makeEntity(name, getActor);
  });
  entities.AuditLog = makeAuditEntity(getActor);
  client.auth = makeAuth(getActor);
  client.integrations = makeIntegrations(getActor);
  client.functions = {
    async invoke(name, args) {
      await ensureSeeded();
      const actor = getActor();
      const fn = FUNCTIONS[name];
      // Internal functions run only from other server code, never straight from a screen.
      const hidden = INTERNAL_FUNCTIONS.indexOf(name) >= 0 && !(actor && actor.__system);
      if (!fn || hidden) throw new ApiError(404, 'Unknown function ' + name);
      return fn({ actor, args: args || {}, server: serverClient, transaction });
    },
  };
  return client;
}

export const api = createClient(currentActor);
export const serverClient = createClient(function () {
  return SYSTEM;
});

export default api;
