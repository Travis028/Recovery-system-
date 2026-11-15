import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import useLdrsUser from '@/hooks/useLdrsUser';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/ldrs';

/**
 * Shows a screen only to the roles allowed to open it. This is the screen side; the data
 * layer checks the same rules again on every request.
 */
export default function RoleGuard({ allow, children }) {
  const { user, role, loading } = useLdrsUser();
  if (loading && !user) return <Loader label="Checking access" />;
  if (!user) return null;
  if (allow.indexOf(role) >= 0) return children;

  return (
    <div className="flex justify-center py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-warning-subtle-foreground">Error 403</p>
        <span className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning-subtle text-warning-subtle-foreground">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4">This page is not available to your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ROLE_LABELS[role] ? ROLE_LABELS[role] + ' accounts cannot open it.' : 'Your account cannot open it.'} The menu shows every page you
          can use.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/dashboard">Go to my dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
