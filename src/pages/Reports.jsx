import React, { useEffect, useState, useMemo } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [pays, exps, tens, uns] = await Promise.all([
        mysql.entities.Payment.list("-created_date", 1000),
        mysql.entities.Expense.list("-date", 1000),
        mysql.entities.Tenant.list("-created_date", 1000),
        mysql.entities.Unit.list("-created_date", 1000),
      ]);
      setPayments(pays);
      setExpenses(exps);
      setTenants(tens);
      setUnits(uns);
    } finally {
      setLoading(false);
    }
  }

  const availableMonths = useMemo(() => {
    const set = new Set();
    payments.forEach((p) => p.period && set.add(p.period));
    expenses.forEach((e) => e.date && set.add(e.date.slice(0, 7)));
    set.add(new Date().toISOString().slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [payments, expenses]);

  const monthPayments = payments.filter((p) => p.period === monthFilter && p.status === "Completed");
  const monthExpenses = expenses.filter((e) => e.date && e.date.slice(0, 7) === monthFilter);

  const totalIncome = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  const expectedRent = tenants.filter((t) => t.status === "Active").reduce((s, t) => s + (t.monthly_rent || 0), 0);
  const collectionRate = expectedRent > 0 ? Math.round((totalIncome / expectedRent) * 100) : 0;

  const expenseByCategory = useMemo(() => {
    const map = {};
    monthExpenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + (e.amount || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [monthExpenses]);

  // Last 6 months trend: rent collected vs maintenance costs vs profit
  const trendData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const rent = payments.filter((p) => p.period === key && p.status === "Completed").reduce((s, p) => s + (p.amount || 0), 0);
      const monthExps = expenses.filter((e) => e.date && e.date.slice(0, 7) === key);
      const maintenance = monthExps.filter((e) => e.category === "Maintenance" || e.category === "Repairs").reduce((s, e) => s + (e.amount || 0), 0);
      const otherCosts = monthExps.filter((e) => e.category !== "Maintenance" && e.category !== "Repairs").reduce((s, e) => s + (e.amount || 0), 0);
      const profit = rent - maintenance - otherCosts;
      data.push({ month: d.toLocaleDateString("en", { month: "short" }), Kodi: rent, Matengenezo: maintenance, "Gharama Zingine": otherCosts, Faida: profit });
    }
    return data;
  }, [payments, expenses]);

  // Late payment penalty computation: tenants who haven't paid this month
  const overdueTenants = tenants.filter((t) => {
    if (t.status !== "Active") return false;
    const hasPaid = monthPayments.some((p) => p.tenant_id === t.id);
    return !hasPaid;
  }).map((t) => ({
    ...t,
    penalty: Math.round((t.monthly_rent || 0) * 0.05),
  }));

  const totalPenalties = overdueTenants.reduce((s, t) => s + t.penalty, 0);

  function handlePrint() {
    window.print();
  }

  function downloadCSV() {
    const rows = [
      ["RentSmart Tanzania — Financial Statement", monthFilter],
      [],
      ["INCOME", "", ""],
      ["Expected Rent", expectedRent],
      ["Collected", totalIncome],
      ["Collection Rate", collectionRate + "%"],
      [],
      ["EXPENSES BY CATEGORY", "", ""],
      ...expenseByCategory.map((c) => [c.name, c.value]),
      ["Total Expenses", totalExpenses],
      [],
      ["NET PROFIT", netProfit],
      [],
      ["OVERDUE TENANTS (5% penalty)", "", ""],
      ["Tenant", "Rent", "Penalty"],
      ...overdueTenants.map((t) => [t.full_name, t.monthly_rent, t.penalty]),
      ["Total Penalties", totalPenalties],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-report-${monthFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 print-hide">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Income vs expenses, collection performance & penalty tracking</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="outline" onClick={downloadCSV} className="gap-2"><Download className="w-4 h-4" /> CSV</Button>
          <Button onClick={handlePrint} className="gap-2"><FileText className="w-4 h-4" /> Print</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print-hide">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase">Income</p>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-heading font-bold text-emerald-600 mt-2">{formatTsh(totalIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">{collectionRate}% of {formatTsh(expectedRent)} expected</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase">Expenses</p>
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-rose-600" /></div>
          </div>
          <p className="text-2xl font-heading font-bold text-rose-600 mt-2">{formatTsh(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">{monthExpenses.length} transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase">Net Profit</p>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Wallet className="w-4 h-4 text-indigo-600" /></div>
          </div>
          <p className={`text-2xl font-heading font-bold mt-2 ${netProfit >= 0 ? "text-slate-900" : "text-rose-600"}`}>{formatTsh(netProfit)}</p>
          <p className="text-xs text-slate-400 mt-1">{netProfit >= 0 ? "Surplus" : "Deficit"}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase">Late Penalties</p>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><FileText className="w-4 h-4 text-amber-600" /></div>
          </div>
          <p className="text-2xl font-heading font-bold text-amber-600 mt-2">{formatTsh(totalPenalties)}</p>
          <p className="text-xs text-slate-400 mt-1">{overdueTenants.length} overdue tenants</p>
        </div>
      </div>

      {/* 6-month trend: Rent vs Maintenance vs Profit */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 print-hide">
        <h3 className="font-heading font-semibold text-slate-900 mb-1">Kodi Iliyokusanywa dhidi ya Matengenezo (Miezi 6)</h3>
        <p className="text-xs text-slate-400 mb-4">Ona faida yako kwa haraka kwa kila mwezi</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatTsh(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} labelStyle={{ fontWeight: 600, color: "#1e293b" }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
            <Bar dataKey="Kodi" name="Kodi Iliyokusanywa" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Matengenezo" name="Gharama za Matengenezo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gharama Zingine" name="Gharama Zingine" fill="#fb7185" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Faida" name="Faida" radius={[4, 4, 0, 0]}>
              {trendData.map((entry, i) => (
                <Cell key={`profit-${i}`} fill={entry.Faida >= 0 ? "#3b82f6" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense breakdown pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 print-hide">
          <h3 className="font-heading font-semibold text-slate-900 mb-4">Expense Breakdown — {monthFilter}</h3>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">No expenses for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {expenseByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatTsh(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Overdue tenants */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-slate-900">Overdue Tenants — {monthFilter}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Auto-calculated 5% late penalty for unpaid rent</p>
          </div>
          {overdueTenants.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">All tenants have paid this month ðŸŽ‰</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {overdueTenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.full_name}</p>
                    <p className="text-xs text-slate-400">Rent: {formatTsh(t.monthly_rent)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-rose-600">+{formatTsh(t.penalty)}</p>
                    <p className="text-xs text-slate-400">Owed: {formatTsh((t.monthly_rent || 0) + t.penalty)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print-friendly statement */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">RentSmart Tanzania — Financial Statement</h1>
        <p>Period: {monthFilter}</p>
        <table className="w-full text-sm mt-4">
          <tbody>
            <tr><td>Expected Rent</td><td>{formatTsh(expectedRent)}</td></tr>
            <tr><td>Collected Income</td><td>{formatTsh(totalIncome)}</td></tr>
            <tr><td>Total Expenses</td><td>{formatTsh(totalExpenses)}</td></tr>
            <tr><td>Net Profit</td><td>{formatTsh(netProfit)}</td></tr>
            <tr><td>Late Penalties Due</td><td>{formatTsh(totalPenalties)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}