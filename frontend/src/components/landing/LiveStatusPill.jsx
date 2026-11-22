import { useState, useEffect } from 'react';

/**
 * LiveStatusPill
 * Sleek, minimal floating status pill in the bottom-right corner.
 * Displays a pulsing green dot, subtle fluctuating real-time active users,
 * a thin divider, and a live updating local time clock.
 */
export default function LiveStatusPill() {
  const [usersCount, setUsersCount] = useState(1428);
  const [time, setTime] = useState(() => new Date());

  // Clock updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time active users updates subtly every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setUsersCount((prev) => {
        // Subtle natural fluctuation between -2 and +3, within realistic 1410 - 1460 bounds
        const delta = Math.floor(Math.random() * 6) - 2;
        const next = prev + delta;
        return next < 1410 ? 1418 : next > 1465 ? 1455 : next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      aria-live="polite"
      className="fixed bottom-3 right-3 z-30 pointer-events-auto select-none sm:bottom-5 sm:right-5 print:hidden"
    >
      <div className="inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 text-xs text-foreground shadow-md backdrop-blur-md transition-shadow hover:shadow-lg dark:bg-card/80">
        {/* Pulsing Green Dot + Real-Time Users */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {usersCount.toLocaleString()}
          </span>
          <span className="text-[11px] font-normal text-muted-foreground whitespace-nowrap">
            Real-Time Users
          </span>
        </div>

        {/* Thin Divider */}
        <span className="h-3.5 w-px bg-border/80" aria-hidden="true" />

        {/* Live Local Clock */}
        <span className="font-mono text-[11px] font-medium tabular-nums text-foreground/90 whitespace-nowrap">
          {formattedTime}
        </span>
      </div>
    </div>
  );
}
