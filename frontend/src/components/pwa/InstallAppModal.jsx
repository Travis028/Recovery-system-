import { Download, PlusSquare, Share, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function InstallAppModal({ open, onOpenChange, isIos, onInstall }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Install LDRS Application</DialogTitle>
              <DialogDescription>
                Fast access directly from your phone&apos;s home screen
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isIos ? (
          <div className="space-y-4 py-2 text-sm text-foreground">
            <p className="text-muted-foreground text-xs">
              Follow these simple steps in <strong>Safari</strong> on your iPhone or iPad:
            </p>
            <ol className="space-y-3 rounded-lg border border-border bg-muted/40 p-3.5 text-xs sm:text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                  1
                </span>
                <div>
                  <span className="font-medium">Tap the Share button</span>
                  <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                    Tap the <Share className="h-3.5 w-3.5 text-primary inline" /> icon in your Safari toolbar (at the bottom or top).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                  2
                </span>
                <div>
                  <span className="font-medium">Select &quot;Add to Home Screen&quot;</span>
                  <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                    Scroll down and tap <PlusSquare className="h-3.5 w-3.5 text-primary inline" /> <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                  3
                </span>
                <div>
                  <span className="font-medium">Confirm &quot;Add&quot;</span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Tap <strong>Add</strong> in the top-right corner to place LDRS on your device.
                  </p>
                </div>
              </li>
            </ol>
            <div className="rounded-md bg-primary-subtle/50 p-2.5 text-xs text-primary-subtle-foreground">
              ✓ Works offline, loads faster, and eliminates the browser address bar.
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-sm text-foreground">
            <p className="text-muted-foreground text-xs sm:text-sm">
              Install LDRS on your Android device, Chromebook, or desktop for instant access to lost and found document tracking.
            </p>
            <ul className="space-y-2 rounded-lg border border-border bg-muted/40 p-3.5 text-xs">
              <li className="flex items-center gap-2">
                <span className="text-success font-bold">✓</span>
                <span>Fast 1-click launch from your home screen or app drawer</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success font-bold">✓</span>
                <span>Responsive full-screen experience with no address bar clutter</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success font-bold">✓</span>
                <span>Instant notifications for matched documents</span>
              </li>
            </ul>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isIos && (
            <Button
              size="sm"
              onClick={async () => {
                await onInstall();
                onOpenChange(false);
              }}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Install App
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
