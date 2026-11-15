import { useEffect } from 'react';
import { api } from '@/api/client';

const IDLE_MINUTES = 15;

/**
 * Signs the user out after a period with no activity.
 * Keeps an unattended station from staying logged in.
 */
export default function useIdleLogout(enabled) {
    useEffect(
        function () {
            if (!enabled) return undefined;
            let timer = null;

            const reset = function () {
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    api.auth.logout('/login');
                }, IDLE_MINUTES * 60 * 1000);
            };

            const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
            events.forEach(function (name) {
                window.addEventListener(name, reset, { passive: true });
            });
            reset();

            return function () {
                if (timer) clearTimeout(timer);
                events.forEach(function (name) {
                    window.removeEventListener(name, reset);
                });
            };
        },
        [enabled],
    );
}
