import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Card = forwardRef(function Card({ className, as: Tag = 'div', ...props }, ref) {
  return <Tag ref={ref} className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />;
});

function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-wrap items-start justify-between gap-3 px-card pt-card', className)} {...props} />;
}

function CardTitle({ className, as: Tag = 'h2', ...props }) {
  return <Tag className={cn('text-base font-semibold leading-6 text-foreground', className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn('p-card', className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-t border-border px-card py-4', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
