import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { fieldClasses } from '@/components/ui/input';

const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea className={cn(fieldClasses, 'min-h-[80px] py-2', className)} ref={ref} {...props} />;
});

export { Textarea };
