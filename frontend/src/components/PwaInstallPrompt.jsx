import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Check if app is already running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
      setShowBanner(false);
      return;
    }

    // iOS users get a custom instruction banner, as they do not trigger beforeinstallprompt
    if (ios) {
      // Show iOS help banner (unless dismissed session-wise)
      const dismissed = sessionStorage.getItem('pwa-ios-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (isIOS) {
      sessionStorage.setItem('pwa-ios-dismissed', 'true');
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[999999] bg-emerald-500 text-slate-950 px-4 py-2.5 flex items-center justify-between text-xs font-bold font-sans shadow-2xl select-none border-b border-emerald-400">
      <div className="flex items-center gap-2 pr-4">
        <Download className="w-4 h-4 flex-shrink-0 animate-bounce" />
        {isIOS ? (
          <span className="leading-snug">
            To install: Tap Safari's <span className="underline">Share</span> button, then select <span className="underline">"Add to Home Screen"</span>.
          </span>
        ) : (
          <span>Install DevShaala Meet App on your home screen for the best experience!</span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {!isIOS && (
          <button
            onClick={handleInstallClick}
            className="bg-slate-950 text-white px-3 py-1 rounded-lg hover:bg-slate-900 transition active:scale-95 cursor-pointer uppercase text-[9px] font-black tracking-wider"
          >
            Install
          </button>
        )}
        <button onClick={handleDismiss} className="p-1 hover:bg-black/10 rounded-full transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
