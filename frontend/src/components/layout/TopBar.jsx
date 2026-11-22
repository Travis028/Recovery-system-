import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Brand from '@/components/layout/Brand';
import ThemeToggle from '@/theme/ThemeToggle';
import { InstallAppButton } from '@/components/pwa/InstallAppBanner';
import { screenForPath } from '@/lib/nav';

export default function TopBar({ onOpenMenu, children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const screen = screenForPath(pathname);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const isDashboard = pathname === '/dashboard';

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-2.5 border-b border-border bg-card/95 px-page-x backdrop-blur supports-[backdrop-filter]:bg-card/80 print:hidden">
      <Button type="button" variant="ghost" size="icon" className="-ml-2 xl:hidden" aria-label="Open menu" onClick={onOpenMenu}>
        <Menu aria-hidden="true" />
      </Button>
      <Brand compact className="xl:hidden" />

      {isDashboard ? (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Return to Public Landing Page"
        >
          <Link to="/">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Landing Page</span>
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Go back to previous page"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      )}

      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {screen ? screen.label : 'Lost Documents Recovery System'}
      </p>
      <div className="flex items-center gap-1.5">
        <InstallAppButton variant="ghost" size="sm" className="hidden sm:inline-flex text-xs h-8" />
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
