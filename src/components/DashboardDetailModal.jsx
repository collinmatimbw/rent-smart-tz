import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function DashboardDetailModal({ title, sub, onClose, children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5" role="presentation">
      <button className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-label="Close dialog" />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-slate-800">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Dashboard detail</p>
            <h2 id="dashboard-dialog-title" className="font-heading text-lg font-bold text-slate-950 dark:text-white">{title}</h2>
            {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
