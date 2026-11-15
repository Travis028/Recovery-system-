import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import Brand from '@/components/layout/Brand';
import SidebarNav from '@/components/layout/SidebarNav';

/** The sidebar as a drawer for phones and tablets. */
export default function MobileNav({ open, onOpenChange, sections }) {
  const close = function () {
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="xl:hidden">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-topbar items-center border-b border-border px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav sections={sections} onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
