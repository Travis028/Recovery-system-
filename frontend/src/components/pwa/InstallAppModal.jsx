import { Download, Laptop, PlusSquare, Share2, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function InstallAppModal({ open, onOpenChange, isIos, isAndroid, hasNativePrompt, onInstall }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Install Recovery Application</DialogTitle>
              <DialogDescription>
                Fast access directly from your phone or desktop
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isIos ? (
          <div className="space-y-3.5 py-2 text-sm text-foreground">
            <p className="text-muted-foreground text-xs leading-relaxed">
              To install <strong>Recovery</strong> on your iPhone or iPad, use <strong>Apple Safari</strong>:
            </p>
            <ol className="space-y-3 rounded-lg border border-border bg-muted/40 p-3.5 text-xs sm:text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                  1
                </span>
                <div>
                  <span className="font-medium">Tap the Share button</span>
                  <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                    Tap the <Share2 className="h-3.5 w-3.5 text-primary inline" /> icon at the bottom of Safari.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                  2
                </span>
                <div>
                  <span className="font-medium">Choose &quot;Add to Home Screen&quot;</span>
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
                  <span className="font-medium">Tap &quot;Add&quot;</span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Tap <strong>Add</strong> in the top-right corner. It will appear on your screen as <strong>Recovery</strong>.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        ) : isAndroid ? (
          <div className="space-y-3.5 py-2 text-sm text-foreground">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Install <strong>Recovery</strong> on your Android phone or tablet for 1-tap access:
            </p>
            {hasNativePrompt ? (
              <div className="rounded-lg border border-border bg-card p-3 text-center space-y-2">
                <p className="text-xs font-medium">Click below to trigger instant installation:</p>
                <Button
                  className="w-full"
                  onClick={async () => {
                    await onInstall();
                    onOpenChange(false);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install Recovery Now
                </Button>
              </div>
            ) : (
              <ol className="space-y-3 rounded-lg border border-border bg-muted/40 p-3.5 text-xs sm:text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    1
                  </span>
                  <div>
                    <span className="font-medium">Open Chrome Menu</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Tap the <strong>three dots (⋮)</strong> in the top-right corner.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    2
                  </span>
                  <div>
                    <span className="font-medium">Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Select <strong>Install app</strong> from the menu options.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    3
                  </span>
                  <div>
                    <span className="font-medium">Confirm Install</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      The app will install as <strong>Recovery</strong> in your phone drawer.
                    </p>
                  </div>
                </li>
              </ol>
            )}
          </div>
        ) : (
          <div className="space-y-3.5 py-2 text-sm text-foreground">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Install <strong>Recovery</strong> as a desktop application on Windows, Mac, or ChromeOS:
            </p>
            {hasNativePrompt ? (
              <div className="rounded-lg border border-border bg-card p-3 text-center space-y-2">
                <Button
                  className="w-full"
                  onClick={async () => {
                    await onInstall();
                    onOpenChange(false);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install Recovery to Desktop
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <Laptop className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Browser Address Bar Shortcut</p>
                    <p className="text-muted-foreground mt-0.5">
                      Look at the right side of your browser URL bar for the <strong>Install icon (💻 or ⬇️)</strong> and click it.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 pt-2 border-t border-border">
                  <Download className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Or Browser Menu</p>
                    <p className="text-muted-foreground mt-0.5">
                      Click the browser menu (<strong>⋮</strong>) ➔ <strong>Save and share</strong> ➔ <strong>Install Recovery...</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {hasNativePrompt && !isIos && (
            <Button
              size="sm"
              onClick={async () => {
                await onInstall();
                onOpenChange(false);
              }}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Install Now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
