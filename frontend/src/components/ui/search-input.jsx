import { forwardRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Text box with a search icon. `label` is read by screen readers only. */
const SearchInput = forwardRef(function SearchInput({ label, className, id, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input ref={ref} id={id} type="search" className="pl-9" {...props} />
    </div>
  );
});

export { SearchInput };
