import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        primary: 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground',
        accent: 'border-accent/25 bg-accent-subtle text-accent-subtle-foreground',
        success: 'border-success-border bg-success-subtle text-success-subtle-foreground',
        warning: 'border-warning-border bg-warning-subtle text-warning-subtle-foreground',
        danger: 'border-danger-border bg-danger-subtle text-danger-subtle-foreground',
        info: 'border-info-border bg-info-subtle text-info-subtle-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({ tone, className, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
