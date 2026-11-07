import { Link } from 'react-router-dom';
import { RotateCcw, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A failed dynamic import usually means a new version was deployed while the page was open.
function isStaleBuild(error) {
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(error && error.message));
}

/** Error 500: something broke while showing a screen. */
export default function ServerError({ error, embedded = false }) {
  const stale = isStaleBuild(error);
  return (
    <div className={cn('flex items-center justify-center px-page-x', embedded ? 'py-16' : 'min-h-screen bg-background')}>
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-danger-subtle-foreground">Error 500</p>
        <span className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger-subtle-foreground">
          <ServerCrash className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4">{stale ? 'LDRS has been updated' : 'Something went wrong on this page'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stale
            ? 'Reload to get the latest version. Nothing you saved has been lost.'
            : 'The problem has been logged in the browser console. Reload the page, or go back to your dashboard and try again.'}
        </p>
        {import.meta.env.DEV && error ? <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">{String(error.message || error)}</pre> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden="true" />
            Reload the page
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/dashboard">Go to my dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
