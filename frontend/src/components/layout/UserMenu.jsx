import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_LABELS } from '@/lib/ldrs';

function initials(name) {
  return String(name || '?')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function (part) {
      return part.charAt(0).toUpperCase();
    })
    .join('');
}

export default function UserMenu({ user, role, onSignOut }) {
  const name = user.full_name || user.email;
  const canManageData = role === 'Owner' || role === 'Finder';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={'Account menu for ' + name}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium text-foreground md:inline">{name}</span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:inline" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          <Badge tone="primary" className="mt-2">
            {ROLE_LABELS[role] || 'New account'}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canManageData ? (
          <DropdownMenuItem asChild>
            <Link to="/my-data">
              <UserRound />
              My data and privacy
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
