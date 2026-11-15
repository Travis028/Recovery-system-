import { cn } from '@/lib/utils';

const TONES = {
  primary: 'bg-primary-subtle text-primary-subtle-foreground',
  accent: 'bg-accent-subtle text-accent-subtle-foreground',
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  danger: 'bg-danger-subtle text-danger-subtle-foreground',
  info: 'bg-info-subtle text-info-subtle-foreground',
  neutral: 'bg-muted text-muted-foreground',
};

export default function StatCard({ label, value, icon: Icon, tone = 'primary', hint }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', TONES[tone] || TONES.primary)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value === null || value === undefined ? '—' : value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
