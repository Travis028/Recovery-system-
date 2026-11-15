import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** items: [{ label, to? }]; the last item is the current page. */
export default function Breadcrumbs({ items }) {
  if (!items || !items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map(function (item, index) {
          const last = index === items.length - 1;
          return (
            <li key={item.label + index} className="flex items-center gap-1">
              {item.to && !last ? (
                <Link to={item.to} className="rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-foreground' : undefined}>
                  {item.label}
                </span>
              )}
              {last ? null : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
