import React from "react";
import { ArrowUpRight } from "lucide-react";

export default function StatCard({ label, value, sub, icon: Icon, color, bg, onClick }) {
  const className = `group w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 ${
    onClick
      ? "cursor-pointer hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:hover:border-emerald-700 dark:hover:shadow-none"
      : ""
  }`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg || "bg-slate-50"}`}>
            <Icon className={`h-5 w-5 ${color || "text-slate-500"}`} aria-hidden="true" />
          </div>
        )}
        {onClick && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition group-hover:bg-emerald-50 group-hover:text-emerald-700 dark:group-hover:bg-emerald-950/40">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate font-heading text-2xl font-bold tracking-tight text-slate-950 dark:text-white lg:text-[1.7rem]">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className} aria-label={`${label}: ${value}`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
