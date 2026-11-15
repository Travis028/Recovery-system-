import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Brand from '@/components/layout/Brand';
import ThemeToggle from '@/theme/ThemeToggle';
import { screenForPath } from '@/lib/nav';

export default function TopBar({ onOpenMenu, children }) {
  const { pathname } = useLocation();
  const screen = screenForPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-3 border-b border-border bg-card/95 px-page-x backdrop-blur supports-[backdrop-filter]:bg-card/80 print:hidden">
      <Button type="button" variant="ghost" size="icon" className="-ml-2 xl:hidden" aria-label="Open menu" onClick={onOpenMenu}>
        <Menu aria-hidden="true" />
      </Button>
      <Brand compact className="xl:hidden" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
        {screen ? screen.label : 'Lost Documents Recovery System'}
      </p>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
