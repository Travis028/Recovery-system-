import { cn } from '@/lib/utils';

/** A row of toggle buttons for one filter. options: [{ value, label, count? }] */
export default function FilterChips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(function (option) {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={function () {
              onChange(option.value);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
