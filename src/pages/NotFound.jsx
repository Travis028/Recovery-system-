import { Link, useLocation } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Error 404, shown inside the signed-in layout for any unknown address. */
export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="flex justify-center py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-primary">Error 404</p>
        <span className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There is no page at <span className="break-all font-mono text-foreground">{pathname}</span>. The link may be mistyped, or the
          page may have moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/dashboard">Go to my dashboard</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/pickup-points">See pickup points</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
