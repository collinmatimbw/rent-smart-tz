export const ROLES = {
  admin: { label: "Admin", description: "Mwenye usimamizi mkuu — ona na badilisha kila kitu", color: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  manager: { label: "Meneja", description: "Meneja wa mali — kila kitu ila mipangilio ya system", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  accountant: { label: "Mhasibu", description: "Malipo, gharama, ripoti, tenants", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  msimamizi: { label: "Msimamizi", description: "Usimamizi wa uendeshaji — properties, tenants, maintenance", color: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  user: { label: "Mfanyakazi", description: "Caretaker/staff wa kawada — bila fedha, staff, au ripoti za kifedha", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};

export const ROLE_ACCESS = {
  admin: [
    "/", "/notifications", "/properties", "/tenants", "/leads", "/contracts",
    "/payments", "/penalties", "/expenses", "/utilities", "/maintenance",
    "/inventory", "/staff", "/cash-flow", "/reports", "/ai-assistant",
    "/import", "/settings", "/users",
  ],
  manager: [
    "/", "/notifications", "/properties", "/tenants", "/leads", "/contracts",
    "/payments", "/penalties", "/expenses", "/utilities", "/maintenance",
    "/inventory", "/staff", "/cash-flow", "/reports", "/ai-assistant",
  ],
  accountant: [
    "/", "/notifications", "/tenants", "/payments", "/penalties",
    "/expenses", "/cash-flow", "/reports", "/ai-assistant",
  ],
  msimamizi: [
    "/", "/notifications", "/properties", "/tenants", "/leads", "/contracts",
    "/utilities", "/maintenance", "/inventory", "/staff", "/ai-assistant",
  ],
  user: [
    "/", "/notifications", "/properties", "/tenants", "/leads", "/contracts",
    "/utilities", "/maintenance", "/inventory", "/ai-assistant",
  ],
};

export function canAccess(role, path) {
  if (!role) return false;
  const allowed = ROLE_ACCESS[role] || [];
  if (path === "/") return allowed.includes("/");
  return allowed.some((p) => path.startsWith(p));
}

export function canSeeFinances(role) {
  return ["admin", "manager", "accountant"].includes(role);
}

export function getAccessibleNav(role, allNavItems) {
  const allowed = ROLE_ACCESS[role] || [];
  return allNavItems.filter((item) => {
    if (item.path === "/") return allowed.includes("/");
    return allowed.some((p) => item.path.startsWith(p));
  });
}