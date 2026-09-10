import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { formatTsh } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Wrench } from "lucide-react";
import StatCard from "@/components/StatCard";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShort(amount) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

export default function FinancialReport({ payments, expenses, currentMonth }) {
  const data = useMemo(() => {
    const byMonth = {};
    // Last 6 months including current
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
      byMonth[key] = { label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, rent: 0, maintenance: 0, otherExpenses: 0 };
    }

    payments.forEach((p) => {
      if (p.status !== "Completed" || !p.period) return;
      if (byMonth[p.period]) {
        byMonth[p.period].rent += p.amount || 0;
      }
    });

    expenses.forEach((e) => {
      if (!e.date) return;
      const period = e.date.slice(0, 7);
      if (byMonth[period]) {
        if (e.category === "Maintenance" || e.category === "Repairs") {
          byMonth[period].maintenance += e.amount || 0;
        } else {
          byMonth[period].otherExpenses += e.amount || 0;
        }
      }
    });

    return months.map((m) => {
      const d = byMonth[m.key];
      const totalExpenses = d.maintenance + d.otherExpenses;
      const profit = d.rent - totalExpenses;
      return { ...d, profit };
    });
  }, [payments, expenses]);

  const currentMonthData = data.find((d) => {
    const now = new Date();
    const label = `${MONTH_NAMES[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
    return d.label === label;
  }) || data[data.length - 1] || { rent: 0, maintenance: 0, otherExpenses: 0, profit: 0 };

  const totalRent = data.reduce((s, d) => s + d.rent, 0);
  const totalMaintenance = data.reduce((s, d) => s + d.maintenance, 0);
  const totalExpenses = data.reduce((s, d) => s + d.maintenance + d.otherExpenses, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Ripoti ya Kifedha (Miezi 6)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Kodi iliyokusanywa, gharama za matengenezo & faida</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Kodi
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-amber-500 rounded-full" /> Matengenezo
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-rose-400 rounded-full" /> Gharama Zingine
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-blue-600 rounded-full" /> Faida
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Kodi (Miezi 6)" value={formatTsh(totalRent)} sub="Jumla iliyokusanywa" icon={Wallet} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Matengenezo" value={formatTsh(totalMaintenance)} sub="Gharama za ukarabati" icon={Wrench} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Gharama Zote" value={formatTsh(totalExpenses)} sub={`Ikijumuisha ${formatTsh(totalMaintenance)} matengenezo`} icon={TrendingDown} color="text-rose-600" bg="bg-rose-50" />
        <StatCard label="Faida Halisi" value={formatTsh(totalProfit)} sub={totalProfit >= 0 ? "Faida nzuri" : "Hasara"} icon={TrendingUp} color={totalProfit >= 0 ? "text-blue-600" : "text-rose-600"} bg={totalProfit >= 0 ? "bg-blue-50" : "bg-rose-50"} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-heading font-semibold text-slate-900 mb-4">Mwenendo wa Kifedha kwa Mwezi</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis tickFormatter={formatShort} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => formatTsh(v)}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              labelStyle={{ fontWeight: 600, color: "#1e293b" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
            <Bar dataKey="rent" name="Kodi" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="maintenance" name="Matengenezo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="otherExpenses" name="Gharama Zingine" fill="#fb7185" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="Faida" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`profit-${index}`} fill={entry.profit >= 0 ? "#3b82f6" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-heading font-semibold text-slate-900">Uchambuzi wa Kila Mwezi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Mwezi</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Kodi Iliyokusanywa</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Matengenezo</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Gharama Zote</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Faida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((d) => {
                const totalExp = d.maintenance + d.otherExpenses;
                return (
                  <tr key={d.label} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.label}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatTsh(d.rent)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatTsh(d.maintenance)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatTsh(totalExp)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${d.profit >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {formatTsh(d.profit)}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-slate-100 font-semibold">
                <td className="px-4 py-3 text-slate-900">Jumla</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatTsh(totalRent)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{formatTsh(totalMaintenance)}</td>
                <td className="px-4 py-3 text-right text-rose-700">{formatTsh(totalExpenses)}</td>
                <td className={`px-4 py-3 text-right ${totalProfit >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                  {formatTsh(totalProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}