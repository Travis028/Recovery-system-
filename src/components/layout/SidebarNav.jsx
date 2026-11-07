import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Grouped menu used by the desktop sidebar and the mobile drawer. */
export default function SidebarNav({ sections, onNavigate }) {
  return (
    <nav aria-label="Main" className="space-y-6">
      {sections.map(function (section) {
        return (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map(function (item) {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={function ({ isActive }) {
                        return cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-primary-subtle text-primary-subtle-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        );
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
