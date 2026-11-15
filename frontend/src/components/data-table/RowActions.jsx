import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Secondary row actions in a menu, so wide tables keep their columns on tablets. items: [{ label, icon?, onSelect, danger? }] */
export default function RowActions({ label, items }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {items.map(function (item) {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect} className={cn(item.danger && 'text-danger-subtle-foreground [&_svg]:text-danger-subtle-foreground')}>
              {Icon ? <Icon aria-hidden="true" /> : null}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
