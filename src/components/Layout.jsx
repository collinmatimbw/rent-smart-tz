import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  FileText,
  Languages,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Package,
  Percent,
  Receipt,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Sun,
  Upload,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";
import { useAuth } from "@/lib/AuthContext";
import { getAccessibleNav, ROLES } from "@/lib/roles";
import { useTranslation } from "@/lib/i18n";

const navGroups = [
  {
    label: { en: "Overview", sw: "Muhtasari" },
    items: [
      { label: "nav.dashboard", path: "/", icon: LayoutDashboard },
      { label: "nav.alerts", path: "/notifications", icon: Bell },
    ],
  },
  {
    label: { en: "Portfolio", sw: "Mali" },
    items: [
      { label: "nav.properties", path: "/properties", icon: Building2 },
      { label: "nav.tenants", path: "/tenants", icon: Users },
      { label: "nav.leads", path: "/leads", icon: UserPlus },
      { label: "nav.contracts", path: "/contracts", icon: FileText },
    ],
  },
  {
    label: { en: "Finance", sw: "Fedha" },
    items: [
      { label: "nav.payments", path: "/payments", icon: Wallet },
      { label: "nav.penalties", path: "/penalties", icon: Percent },
      { label: "nav.expenses", path: "/expenses", icon: Receipt },
      { label: "nav.cashFlow", path: "/cash-flow", icon: LineChart },
      { label: "nav.reports", path: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: { en: "Operations", sw: "Uendeshaji" },
    items: [
      { label: "nav.utilities", path: "/utilities", icon: Zap },
      { label: "nav.maintenance", path: "/maintenance", icon: Wrench },
      { label: "nav.inventory", path: "/inventory", icon: Package },
      { label: "nav.staff", path: "/staff", icon: UserCog },
    ],
  },
  {
    label: { en: "Workspace", sw: "Mfumo" },
    items: [
      { label: "nav.aiAssistant", path: "/ai-assistant", icon: Sparkles },
      { label: "nav.importData", path: "/import", icon: Upload },
      { label: "nav.users", path: "/users", icon: Shield },
      { label: "nav.settings", path: "/settings", icon: SettingsIcon },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);

function Brand({ compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-emerald-400 shadow-sm dark:bg-emerald-400 dark:text-slate-950">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-bold tracking-tight text-slate-950 dark:text-white">
          RentSmart Tanzania
        </p>
        {!compact && <p className="truncate text-[11px] text-slate-400">Property management</p>}
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const accessiblePaths = new Set(getAccessibleNav(user?.role, allNavItems).map((item) => item.path));
  const roleInfo = ROLES[user?.role] || ROLES.user;
  const isActive = (path) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));

  const renderNavigation = () => (
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Primary navigation">
      <div className="space-y-6">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => accessiblePaths.has(item.path));
          if (!items.length) return null;
          return (
            <div key={group.label.en}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {group.label[lang] || group.label.en}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-slate-950 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-950"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }`}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-emerald-400 dark:text-slate-950" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"}`} aria-hidden="true" />
                      <span className="truncate">{t(item.label)}</span>
                      {active && <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-emerald-400 dark:bg-slate-950" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );

  const renderUserPanel = () => (
    <div className="border-t border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLang}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Change language"
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
          {lang === "en" ? "English" : "Kiswahili"}
        </button>
        <button
          type="button"
          onClick={() => setDark((value) => !value)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={dark ? "Use light mode" : "Use dark mode"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-400 dark:text-slate-950">
            {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.full_name || "User"}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => logout(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-800">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${roleInfo.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${roleInfo.dot}`} />
            {t(`role.${user?.role || "user"}`)}
          </span>
          <span className="text-[10px] text-slate-400">Secure session</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-950">
        <div className="flex h-[76px] items-center border-b border-slate-200 px-5 dark:border-slate-800">
          <Brand />
        </div>
        {renderNavigation()}
        {renderUserPanel()}
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <Brand compact />
        <div className="flex items-center gap-1">
          <Link to="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Link>
          <button type="button" onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,300px)] flex-col bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <Brand compact />
              <button type="button" onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavigation()}
            {renderUserPanel()}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1 pt-16 lg:ml-72 lg:pt-0">
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
          <Outlet />
        </main>
      </div>
      <InstallPrompt />
    </div>
  );
}
