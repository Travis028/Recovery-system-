import { RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shown when a screen's data could not be loaded, with a way to try again. */
export default function ErrorState({ title = 'This could not be loaded', error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-lg border border-danger-border bg-danger-subtle px-6 py-10 text-center text-danger-subtle-foreground">
      <XCircle className="h-6 w-6" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm">{(error && error.message) || 'Check your connection and try again.'}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
