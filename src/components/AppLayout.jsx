import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser, { sessionHasEnded } from '@/hooks/useLdrsUser';
import useIdleLogout from '@/hooks/useIdleLogout';
import { navSectionsForRole } from '@/lib/nav';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import TopBar from '@/components/layout/TopBar';
import UserMenu from '@/components/layout/UserMenu';
import AccountNotices from '@/components/layout/AccountNotices';
import DemoPhone from '@/components/security/DemoPhone';
import Loader from '@/components/Loader';

export default function AppLayout() {
  const { user, role, loading } = useLdrsUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { pathname } = location;

  useIdleLogout(Boolean(user));

  // Back/forward and links inside pages also change the route; the drawer should not stay open.
  useEffect(
    function () {
      setMenuOpen(false);
    },
    [pathname],
  );

  if (loading) return <Loader label="Opening LDRS" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search, expired: sessionHasEnded() }} />;

  const sections = navSectionsForRole(role);

  const handleLogout = function () {
    base44.auth.logout('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to main content
      </a>
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

        <main id="main-content" tabIndex={-1} className="mx-auto outline-none w-full max-w-content px-page-x pb-24 pt-page-y lg:pb-12 print:max-w-none print:p-0">
          <AccountNotices user={user} role={role} />
          <Outlet />
        </main>
      </div>

      <DemoPhone />
    </div>
  );
}
