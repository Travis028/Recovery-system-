import { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePwaInstall from '@/hooks/usePwaInstall';
import InstallAppModal from '@/components/pwa/InstallAppModal';

/**
 * Clean floating banner for mobile browsers prompting installation.
 */
export default function InstallAppBanner() {
  const { isInstalled, isIos, isAndroid, hasNativePrompt, showGuide, setShowGuide, promptInstall } =
    usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('ldrs.pwa.dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [modalOpen, setModalOpen] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('ldrs.pwa.dismissed', '1');
    } catch {
      // Storage might be restricted in private browsing
    }
  };

  const handleAction = async () => {
    if (hasNativePrompt && !isIos) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <aside
        aria-label="Install mobile application"
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-primary/30 bg-card/95 p-3.5 shadow-xl backdrop-blur-md sm:left-auto sm:right-6 sm:bottom-6 print:hidden"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">
              Install Recovery on your phone
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Fast, offline-ready document recovery
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-8 px-3 text-xs shadow-sm"
              onClick={handleAction}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Install
            </Button>
            <button
              type="button"
              aria-label="Dismiss install banner"
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <InstallAppModal
        open={modalOpen || showGuide}
        onOpenChange={(open) => {
          setModalOpen(open);
          setShowGuide(open);
        }}
        isIos={isIos}
        isAndroid={isAndroid}
        hasNativePrompt={hasNativePrompt}
        onInstall={promptInstall}
      />
    </>
  );
}

/**
 * Reusable inline "Install App" button for Navbars, Headers, or Menus.
 */
export function InstallAppButton({ variant = 'outline', size = 'sm', className = '' }) {
  const { isInstalled, isIos, isAndroid, hasNativePrompt, showGuide, setShowGuide, promptInstall } =
    usePwaInstall();
  const [modalOpen, setModalOpen] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (hasNativePrompt && !isIos) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
        title="Install Recovery on your device"
      >
        <Smartphone className="mr-1.5 h-4 w-4" aria-hidden="true" />
        <span>Install App</span>
      </Button>

      <InstallAppModal
        open={modalOpen || showGuide}
        onOpenChange={(open) => {
          setModalOpen(open);
          setShowGuide(open);
        }}
        isIos={isIos}
        isAndroid={isAndroid}
        hasNativePrompt={hasNativePrompt}
        onInstall={promptInstall}
      />
    </>
  );
}
