import Brand from '@/components/layout/Brand';
import SidebarNav from '@/components/layout/SidebarNav';

/** Fixed sidebar from 1280px. Tablets and phones use the drawer in the top bar, so tables keep their full width. */
export default function Sidebar({ sections, footer }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-border bg-card xl:flex print:hidden">
      <div className="flex h-topbar items-center border-b border-border px-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <SidebarNav sections={sections} />
      </div>
      {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
    </aside>
  );
}
