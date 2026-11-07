import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { resolveRole } from '@/lib/ldrs';

/**
 * Loads the signed-in LDRS user together with the role the app routes on.
 * A 401 simply means there is no session yet — the layout sends the visitor to login.
 */
// Remembers the signed-in user across screens, so a page that mounts while
// another lookup is still running already has the user instead of null.
// Every screen using this hook is told when the user record changes (for example
// after the phone number is verified).
let cachedUser = null;
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
  listeners.forEach(function (listener) {
    listener(user);
  });
}

export async function reloadLdrsUser() {
  try {
    const me = await base44.auth.me();
    publish(me);
    return me;
  } catch (error) {
    if (error && error.status !== 401) {
      console.error('Could not load the signed-in user', error);
    }
    publish(null);
    return null;
  }
}

export default function useLdrsUser() {
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    const listener = function (next) {
      setUser(next);
      setLoading(false);
    };
    listeners.add(listener);
    reloadLdrsUser();
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
