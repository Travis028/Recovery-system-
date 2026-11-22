import { useState, useEffect, useCallback } from 'react';

export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__ldrsDeferredPrompt || null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsInstalled(isStandalone);

    // Detect user platform
    const userAgent = window.navigator.userAgent || '';
    const isApple = /iPhone|iPad|iPod/i.test(userAgent) && !window.MSStream;
    setIsIos(isApple);

    const isGoogleAndroid = /Android/i.test(userAgent);
    setIsAndroid(isGoogleAndroid);

    // Grab globally captured prompt if available
    if (window.__ldrsDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__ldrsDeferredPrompt);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.__ldrsDeferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePromptReady = () => {
      if (window.__ldrsDeferredPrompt) {
        setDeferredPrompt(window.__ldrsDeferredPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__ldrsDeferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('ldrs:prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('ldrs:prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt || window.__ldrsDeferredPrompt;
    if (prompt) {
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        window.__ldrsDeferredPrompt = null;
        return choice ? choice.outcome : 'dismissed';
      } catch (err) {
        console.warn('Install prompt failed, opening guide:', err);
      }
    }

    // No direct browser prompt available, show interactive device installation guide
    setShowGuide(true);
    return 'guide';
  }, [deferredPrompt]);

  return {
    canInstall: !isInstalled,
    hasNativePrompt: Boolean(deferredPrompt || window.__ldrsDeferredPrompt),
    isInstalled,
    isIos,
    isAndroid,
    showGuide,
    setShowGuide,
    promptInstall,
  };
}
