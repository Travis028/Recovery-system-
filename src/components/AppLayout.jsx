import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, Menu, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import { navForRole } from '@/lib/nav';
import { ROLE_LABELS } from '@/lib/ldrs';
import DemoPhone from '@/components/security/DemoPhone';
import { Button } from '@/components/ui/button';
import Loader from '@/components/Loader';
import useIdleLogout from '@/hooks/useIdleLogout';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/theme/ThemeToggle';

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
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useIdleLogout(Boolean(user));

  // Sign-in is recorded in the audit trail by the login itself (server side).

  if (loading) return <Loader label="Opening LDRS" />;
  if (!user) return <Navigate to="/login" replace />;

  const items = navForRole(role);
  const quickItems = items.slice(0, 4);
  const roleLabel = ROLE_LABELS[role] || 'New account';
  const displayName = user.full_name || user.email || 'LDRS user';

  const handleLogout = async function () {
    await base44.auth.logout('/login');
  };

  const Brand = (
    <Link to="/dashboard" className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-violet-700 text-white shadow-sm">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <span>
        <span className="block font-heading text-lg font-bold leading-tight text-slate-900">LDRS</span>
        <span className="block text-xs text-slate-500">Document Recovery</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex print:hidden">
        {Brand}
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">{roleLabel}</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-700">{displayName}</p>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavItems items={items} />
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full justify-start gap-3 rounded-xl border-slate-200 text-slate-600"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </aside>

      <div className="lg:pl-72 print:pl-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8 print:hidden">
          <div className="lg:hidden">{Brand}</div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-slate-500">Lost Documents Recovery System</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 sm:inline-flex">
              {roleLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={function () {
                setMenuOpen(true);
              }}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12 print:max-w-none print:pb-0 print:pt-0">
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
