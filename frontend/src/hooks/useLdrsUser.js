import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { resolveRole } from '@/lib/ldrs';

/**
 * The signed-in LDRS user and the role the app routes on, shared by every screen.
 *
 * The user is fetched once and kept here; components that mount later reuse it instead of
 * asking again, and simultaneous first lookups share one request. reload() fetches again
 * (for example after the phone number is verified) and every screen is told the result.
 * A 401 simply means there is no session yet; the layout sends the visitor to sign-in.
 */
let cachedUser = null;
let loaded = false;
let pending = null;
const listeners = new Set();

let sessionEnded = false;

// A request was refused for lack of a session while someone was signed in: their session
// expired or was revoked (for example after a password reset on another device).
window.addEventListener('ldrs:session-ended', function () {
  if (cachedUser) {
    sessionEnded = true;
    publish(null);
  }
});

/** True after the session ended on its own, until someone signs in again. */
export function sessionHasEnded() {
  return sessionEnded;
}

function publish(user) {
  if (user) sessionEnded = false;
  cachedUser = user;
  loaded = true;
  listeners.forEach(function (listener) {
    listener(user);
  });
}

export function reloadLdrsUser() {
  if (pending) return pending;
  pending = api.auth
    .me()
    .catch(function (error) {
      if (error && error.status !== 401) console.error('Could not load the signed-in user', error);
      return null;
    })
    .then(function (me) {
      pending = null;
      publish(me);
      return me;
    });
  return pending;
}

export default function useLdrsUser() {
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    const listener = function (next) {
      setUser(next);
      setLoading(false);
    };
    listeners.add(listener);
    // The user may have arrived between this render and the effect.
    if (loaded) listener(cachedUser);
    else reloadLdrsUser();
    return function () {
      listeners.delete(listener);
    };
  }, []);

  const reload = useCallback(function () {
    return reloadLdrsUser();
  }, []);

  const role = resolveRole(user);

  return {
    user,
    role,
    loading,
    reload,
  };
}
