import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { resolveRole, isOfficerApproved } from '@/lib/ldrs';

/**
 * Loads the signed-in LDRS user together with the role the app routes on.
 * A 401 simply means there is no session yet — the page shows nothing until the
 * platform redirects to login.
 */
// Remembers the signed-in user across screens, so a page that mounts while
// another lookup is still running already has the user instead of null.
let cachedUser = null;

export default function useLdrsUser() {
    const [user, setUser] = useState(cachedUser);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        if (cachedUser) setUser(cachedUser);
        try {
            const me = await base44.auth.me();
            cachedUser = me;
            setUser(me);
            return me;
        } catch (error) {
            if (error && error.status !== 401) {
                console.error('Could not load the signed-in user', error);
            }
            cachedUser = null;
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const role = resolveRole(user);

    return {
        user,
        role,
        loading,
        reload,
        setUser,
        officerApproved: isOfficerApproved(user),
    };
}
