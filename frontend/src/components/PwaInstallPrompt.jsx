import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Check if app is already running in standalone (installed) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
      setShowBanner(false);
      return;
    }

    // Always show the install prompt if not standalone (bypasses browser constraints)
    const dismissed = sessionStorage.getItem('pwa-prompt-dismissed');
    if (!dismissed) {
      setShowBanner(true);
    }

    // Read globally captured deferred prompt
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    const handleCustomPromptAvailable = (e) => {
      setDeferredPrompt(e.detail);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleCustomPromptAvailable);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleCustomPromptAvailable);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowBanner(false);
    } else {
      // Fallback message for Android browsers without direct prompt
      toast.success("To install: Tap your browser's menu (three dots) and select 'Install app' or 'Add to Home screen'.", {
        duration: 5000
      });
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[999999] bg-emerald-500 text-slate-950 px-4 py-2.5 flex items-center justify-between text-xs font-bold font-sans shadow-2xl select-none border-b border-emerald-400">
      <div className="flex items-center gap-2 pr-4">
        <Download className="w-4 h-4 flex-shrink-0 animate-bounce" />
        {isIOS ? (
          <span className="leading-snug">
            Install PWA: Tap Safari's <span className="underline font-black">Share</span> button, then select <span className="underline font-black">"Add to Home Screen"</span>.
          </span>
        ) : (
          <span className="leading-snug">
            Install DevShaala Meet App on your home screen for the best class experience!
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {!isIOS && (
          <button
            onClick={handleInstallClick}
            className="bg-slate-950 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition active:scale-95 cursor-pointer uppercase text-[9px] font-black tracking-wider shadow-md"
          >
            {deferredPrompt ? 'Install' : 'How to Install'}
          </button>
        )}
        <button onClick={handleDismiss} className="p-1 hover:bg-black/10 rounded-full transition cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
