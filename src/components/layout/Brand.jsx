import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Brand({ to = '/dashboard', compact = false, className }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      {compact ? (
        <span className="sr-only">LDRS home</span>
      ) : (
        <span className="leading-tight">
          <span className="block text-base font-semibold text-foreground">LDRS</span>
          <span className="block text-xs text-muted-foreground">Document Recovery</span>
        </span>
      )}
    </Link>
  );
}
