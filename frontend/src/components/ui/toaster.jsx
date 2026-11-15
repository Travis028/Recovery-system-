import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const TONES = {
  success: { icon: CheckCircle2, className: 'text-success' },
  danger: { icon: XCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-info' },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6 print:hidden"
    >
      {toasts.map(function (item) {
        const tone = TONES[item.tone] || TONES.info;
        const Icon = tone.icon;
        return (
          <div
            key={item.id}
            role={item.tone === 'danger' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-top-2"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', tone.className)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
              {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={function () {
                dismiss(item.id);
              }}
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
