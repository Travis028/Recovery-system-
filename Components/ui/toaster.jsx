import { X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6 print:hidden">
      {toasts.map(function (item) {
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-lg',
              item.variant === 'destructive' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-white text-slate-900',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                {item.title ? <p className="font-heading text-sm font-semibold">{item.title}</p> : null}
                {item.description ? <p className="mt-1 text-sm opacity-80">{item.description}</p> : null}
              </div>
              <button type="button" aria-label="Dismiss" onClick={function () { dismiss(item.id); }} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
