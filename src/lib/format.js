export function formatTsh(amount) {
  if (amount == null || isNaN(amount)) return "Tsh 0";
  return "Tsh " + Number(amount).toLocaleString("en-US");
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function calculateBalance(tenant, payments) {
  if (!tenant?.lease_start || !tenant?.monthly_rent) return 0;
  const leaseStart = new Date(tenant.lease_start);
  const now = new Date();
  const monthsPassed = (now.getFullYear() - leaseStart.getFullYear()) * 12 + (now.getMonth() - leaseStart.getMonth());
  if (monthsPassed < 0) return 0;
  const totalOwed = monthsPassed * (tenant.monthly_rent || 0);
  const totalPaid = (payments || [])
    .filter((p) => p.tenant_id === tenant.id && p.status === "Completed")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  return totalOwed - totalPaid;
}

export function balanceColor(balance) {
  if (balance > 0) return "text-rose-600";
  if (balance < 0) return "text-emerald-600";
  return "text-slate-400";
}

export function statusColor(status) {
  const map = {
    Vacant: "bg-slate-100 text-slate-700",
    Occupied: "bg-emerald-100 text-emerald-700",
    Maintenance: "bg-amber-100 text-amber-700",
    Active: "bg-emerald-100 text-emerald-700",
    Inactive: "bg-slate-100 text-slate-600",
    Notice: "bg-amber-100 text-amber-700",
    Completed: "bg-emerald-100 text-emerald-700",
    Pending: "bg-amber-100 text-amber-700",
    Failed: "bg-rose-100 text-rose-700",
    Open: "bg-rose-100 text-rose-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Assigned: "bg-indigo-100 text-indigo-700",
    Resolved: "bg-emerald-100 text-emerald-700",
    Closed: "bg-slate-100 text-slate-600",
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

export function priorityColor(priority) {
  const map = {
    Low: "bg-slate-100 text-slate-600",
    Medium: "bg-blue-100 text-blue-700",
    High: "bg-amber-100 text-amber-700",
    Urgent: "bg-rose-100 text-rose-700",
  };
  return map[priority] || "bg-slate-100 text-slate-600";
}