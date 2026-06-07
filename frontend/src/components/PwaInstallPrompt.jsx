import React, { useState, useEffect } from 'react';
import { Download, X, AppWindow } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Check if app is already running in standalone (installed) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Always show prompt on mount (bypasses browser constraints for persistent display)
    setShowPrompt(true);

    // Read globally captured deferred prompt
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleCustomPromptAvailable = (e) => {
      setDeferredPrompt(e.detail);
      setShowPrompt(true);
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
      setShowPrompt(false);
    } else {
      // Fallback message for Android browsers without direct prompt
      toast.success("To install: Tap your browser's menu (three dots) and select 'Install app' or 'Add to Home screen'.", {
        duration: 5000
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-sm bg-neutral-950/90 border border-neutral-800 rounded-3xl p-6 shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col items-center text-center space-y-4">
        {/* Header with App Logo */}
        <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-white/5 flex items-center justify-center p-2.5 shadow-inner">
          <img src="/logo.png" alt="DevShaala" className="w-10 h-10 object-contain" />
        </div>
        
        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-wider font-orbitron text-white">Install DevShaala</h2>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
            <AppWindow className="w-3.5 h-3.5 text-emerald-400" />
            Classroom Desktop & Mobile App
          </p>
        </div>

        {/* Benefits list */}
        <div className="w-full text-left bg-neutral-900/60 border border-white/5 rounded-2xl p-4 space-y-2.5 text-[10px] text-slate-300 font-medium">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Immersive, distraction-free fullscreen mode</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Launch instantly from your home screen</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Refined native performance & cached load speeds</span>
          </div>
        </div>

        {/* Action Button layout */}
        <div className="w-full flex flex-col gap-2 pt-2">
          {isIOS ? (
            <div className="text-left bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-[9px] text-emerald-400 font-bold leading-normal">
              Tap Safari's <span className="underline">Share</span> button, then select <span className="underline">"Add to Home Screen"</span>.
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition active:scale-95 shadow-[0_4px_20px_rgba(16,185,129,0.25)] cursor-pointer"
            >
              {deferredPrompt ? 'Install App' : 'How to Install'}
            </button>
          )}
          
          <button
            onClick={handleDismiss}
            className="w-full py-3 bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-300 font-black text-[10px] uppercase tracking-wider rounded-2xl transition cursor-pointer"
          >
            Continue in Browser
          </button>
        </div>
      </div>
    </div>
  );
}

