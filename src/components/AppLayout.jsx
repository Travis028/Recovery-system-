import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import Brand from '@/components/layout/Brand';
import Sidebar from '@/components/layout/Sidebar';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import { navSectionsForRole } from '@/lib/nav';
import { ROLE_LABELS } from '@/lib/ldrs';
import DemoPhone from '@/components/security/DemoPhone';
import { Button } from '@/components/ui/button';
import Loader from '@/components/Loader';
import useIdleLogout from '@/hooks/useIdleLogout';
import { cn } from '@/lib/utils';
import TopBar from '@/components/layout/TopBar';
import { Badge } from '@/components/ui/badge';

function NavItems({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(function (item) {
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={function ({ isActive }) {
              return cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              );
            }}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function AppLayout() {
  const { user, role, loading } = useLdrsUser();
  const [menuOpen, setMenuOpen] = useState(false);

  useIdleLogout(Boolean(user));

  // Sign-in is recorded in the audit trail by the login itself (server side).

  if (loading) return <Loader label="Opening LDRS" />;
  if (!user) return <Navigate to="/login" replace />;

  const sections = navSectionsForRole(role);
  const items = sections.flatMap(function (section) {
    return section.items;
  });
  const quickItems = items.slice(0, 4);
  const roleLabel = ROLE_LABELS[role] || 'New account';
  const displayName = user.full_name || user.email || 'LDRS user';

  const handleLogout = async function () {
    await base44.auth.logout('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        sections={sections}
        footer={
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleLogout}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        }
      />

      <div className="lg:pl-sidebar print:pl-0">
        <TopBar
          onOpenMenu={function () {
            setMenuOpen(true);
          }}
        >
          <span className="ml-1 hidden sm:inline-flex">
            <Badge tone="primary">{roleLabel}</Badge>
          </span>
        </TopBar>

        <main className="mx-auto w-full max-w-content px-page-x pb-28 pt-page-y lg:pb-12 print:max-w-none print:p-0">
          {role === 'Officer' && !user.approved ? (
            <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
              Your officer account is waiting for approval by an administrator. You can look around, but you cannot register,
              confirm or release documents until it is approved.
            </p>
          ) : null}
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden print:hidden">
        {quickItems.map(function (item) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={function ({ isActive }) {
                return cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                  isActive ? 'text-blue-900' : 'text-slate-500',
                );
              }}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate px-1">{item.short || item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={function () {
            setMenuOpen(true);
          }}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-500"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      <DemoPhone />

      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={function () {
              setMenuOpen(false);
            }}
          />
          <div className="relative ml-auto flex h-full w-80 max-w-[85%] flex-col bg-white px-5 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg font-bold text-slate-900">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={function () {
                  setMenuOpen(false);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">{roleLabel}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-700">{displayName}</p>
            </div>
            <div className="mt-5 flex-1 overflow-y-auto">
              <NavItems
                items={items}
                onNavigate={function () {
                  setMenuOpen(false);
                }}
              />
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full justify-start gap-3 rounded-xl border-slate-200 text-slate-600"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
