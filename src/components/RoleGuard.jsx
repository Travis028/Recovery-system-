import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import useLdrsUser from '@/hooks/useLdrsUser';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';

/**
 * Hides a screen from roles that should not see it. This is only the screen side — the
 * same rules are enforced again in the data layer for every request.
 */
export default function RoleGuard({ allow, children }) {
  const { user, role, loading } = useLdrsUser();
  if (loading && !user) return <Loader label="Checking access" />;
  if (!user) return null;
  if (allow.indexOf(role) < 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-bold text-slate-900">This screen is not available for your role</h1>
        <p className="mt-2 text-sm text-slate-500">The attempt has not been recorded as an error. Use the menu to reach the screens for your role.</p>
        <Button className="mt-5 rounded-xl bg-blue-900 hover:bg-blue-950" asChild>
          <Link to="/dashboard">Go to my dashboard</Link>
        </Button>
      </div>
    );
  }
  return children;
}
