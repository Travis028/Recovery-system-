import { useState, useEffect } from 'react';

export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent || '';
    const isAppleDevice = /iPhone|iPad|iPod/i.test(userAgent) && !window.MSStream;
    setIsIos(isAppleDevice);

    // Capture the Chrome/Android beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return choice.outcome;
    }

    if (isIos && !isInstalled) {
      setShowIosGuide(true);
      return 'ios_guide';
    }

    return 'not_available';
  };

  return {
    canInstall: !isInstalled && (Boolean(deferredPrompt) || isIos),
    isInstalled,
    isIos,
    showIosGuide,
    setShowIosGuide,
    promptInstall,
  };
}
