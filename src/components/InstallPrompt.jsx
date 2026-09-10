import React, { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem("installDismissed") === "true") return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      const t = setTimeout(() => setShowBanner(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
    } else {
      setShowIOS(true);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem("installDismissed", "true");
  }

  if (!showBanner) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 lg:left-auto lg:w-96 z-40">
        <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Install RentSmart App</p>
            <p className="text-xs text-white/60 mt-0.5">Tumia kama app kwenye simu yako</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleInstall} className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-semibold hover:bg-slate-100">
              Install
            </button>
            <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showIOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowIOS(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-slate-900">Jinsi ya kuweka App kwenye iPhone</h3>
              <button onClick={() => setShowIOS(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">1</span>
                <span>Bonyeza kitufe cha <strong>Share</strong> chini ya safu ya kichwa cha Safari.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">2</span>
                <span>Chagua <strong>"Add to Home Screen"</strong> kutoka kwenye orodha.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">3</span>
                <span>Bonyeza <strong>"Add"</strong> — App itaonekana kwenye skrini yako ya nyumbani.</span>
              </li>
            </ol>
            <button onClick={() => setShowIOS(false)} className="w-full mt-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium">
              Nimeelewa
            </button>
          </div>
        </div>
      )}
    </>
  );
}