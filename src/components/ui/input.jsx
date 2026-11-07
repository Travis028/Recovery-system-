import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Shared look for text inputs, text areas and select triggers. aria-invalid turns the border red.
export const fieldClasses =
  'w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30';

const Input = forwardRef(function Input({ className, type, ...props }, ref) {
  return <input type={type} className={cn(fieldClasses, 'h-10 py-2', className)} ref={ref} {...props} />;
});

export { Input };
