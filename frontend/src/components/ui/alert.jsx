import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-info-border bg-info-subtle text-info-subtle-foreground',
      success: 'border-success-border bg-success-subtle text-success-subtle-foreground',
      warning: 'border-warning-border bg-warning-subtle text-warning-subtle-foreground',
      danger: 'border-danger-border bg-danger-subtle text-danger-subtle-foreground',
      neutral: 'border-border bg-muted text-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info };

/** Inline banner for notices and results. Danger alerts are announced to screen readers. */
export function Alert({ tone = 'info', title, icon, children, action, className, ...props }) {
  const Icon = icon || ICONS[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed [&_a]:font-medium [&_a]:underline">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
