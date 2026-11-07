import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import useIdleLogout from '@/hooks/useIdleLogout';
import { navSectionsForRole } from '@/lib/nav';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import TopBar from '@/components/layout/TopBar';
import UserMenu from '@/components/layout/UserMenu';
import DemoPhone from '@/components/security/DemoPhone';
import Loader from '@/components/Loader';

export default function AppLayout() {
  const { user, role, loading } = useLdrsUser();
  const [menuOpen, setMenuOpen] = useState(false);

  useIdleLogout(Boolean(user));

  if (loading) return <Loader label="Opening LDRS" />;
  if (!user) return <Navigate to="/login" replace />;

  const sections = navSectionsForRole(role);

  const handleLogout = function () {
    base44.auth.logout('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar sections={sections} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} sections={sections} />

      <div className="lg:pl-sidebar print:pl-0">
        <TopBar
          onOpenMenu={function () {
            setMenuOpen(true);
          }}
        >
          <UserMenu user={user} role={role} onSignOut={handleLogout} />
        </TopBar>

        <main className="mx-auto w-full max-w-content px-page-x pb-24 pt-page-y lg:pb-12 print:max-w-none print:p-0">
          {role === 'Officer' && !user.approved ? (
            <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
              Your officer account is waiting for approval by an administrator. You can look around, but you cannot register,
              confirm or release documents until it is approved.
            </p>
          ) : null}
          <Outlet />
        </main>
      </div>

      <DemoPhone />
    </div>
  );
}
