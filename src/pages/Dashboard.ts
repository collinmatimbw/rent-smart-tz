import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CalendarDays, RefreshCw, Wallet } from "lucide-react";
import LegacyDashboard from "./Dashboard.jsx";
import { useAuth } from "@/lib/AuthContext";
import { canSeeFinances } from "@/lib/roles";

const h = React.createElement;

export default function Dashboard() {
  const { user } = useAuth();
  const showFinances = canSeeFinances(user?.role);
  const firstName = (user?.full_name || "there").trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return h(
    "div",
    { className: "space-y-8" },
    h(
      "section",
      { className: "relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-200/60 sm:px-7 sm:py-8 dark:shadow-none" },
      h("div", { className: "pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl", "aria-hidden": "true" }),
      h("div", { className: "pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl", "aria-hidden": "true" }),
      h(
        "div",
        { className: "relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end" },
        h(
          "div",
          null,
          h(
            "div",
            { className: "mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300" },
            h(CalendarDays, { className: "h-3.5 w-3.5 text-emerald-400", "aria-hidden": "true" }),
            today,
          ),
          h("h1", { className: "font-heading text-2xl font-bold tracking-tight sm:text-3xl" }, `Welcome back, ${firstName}`),
          h("p", { className: "mt-2 max-w-xl text-sm leading-6 text-slate-300" }, "Here is the latest overview of your properties, collections and daily operations."),
        ),
        h(
          "div",
          { className: "flex flex-wrap items-center gap-2" },
          h(
            Link,
            { to: "/properties", className: "inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10" },
            h(Building2, { className: "h-4 w-4 text-emerald-400", "aria-hidden": "true" }),
            "Properties",
          ),
          showFinances
            ? h(
                Link,
                { to: "/payments", className: "inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300" },
                h(Wallet, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Record payment",
                h(ArrowRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
              )
            : null,
          h(
            "button",
            { type: "button", onClick: () => window.location.reload(), className: "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white", "aria-label": "Refresh dashboard" },
            h(RefreshCw, { className: "h-4 w-4" }),
          ),
        ),
      ),
    ),
    h("div", { className: "[&>div>div:first-child]:hidden" }, h(LegacyDashboard)),
  );
}
