import { cn } from '@/lib/utils';

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />;
}

/** Placeholder rows while a list or table loads. */
export function SkeletonRows({ rows = 5, label = 'Loading' }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map(function (_, index) {
        return <Skeleton key={index} className="h-12 w-full" />;
      })}
    </div>
  );
}
