import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatTsh } from "@/lib/format";
import { Building2, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShort(amount) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

export default function PropertyCollectionReport({ payments, tenants, properties, currentMonth }) {
  // Monthly collection for last 6 months
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, collected: 0, outstanding: 0 });
    }
    const byMonth = {};
    months.forEach((m) => { byMonth[m.key] = m; });

    // Expected rent per month = sum of all active tenants' monthly_rent
    const monthlyExpected = tenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);

    payments.forEach((p) => {
      if (p.status !== "Completed" || !p.period) return;
      if (byMonth[p.period]) {
        byMonth[p.period].collected += p.amount || 0;
      }
    });

    // For current month, outstanding = expected - collected
    // For past months, outstanding = expected - collected (capped at 0 minimum)
    months.forEach((m) => {
      m.expected = monthlyExpected;
      m.outstanding = Math.max(0, monthlyExpected - m.collected);
      m.collectionRate = monthlyExpected > 0 ? Math.round((m.collected / monthlyExpected) * 100) : 0;
    });

    return months;
  }, [payments, tenants]);

  // Per-property breakdown for current month
  const propertyData = useMemo(() => {
    const propName = (id) => properties.find((p) => p.id === id)?.name || "—";
    const byProp = {};

    // Initialize with expected rent from tenants
    tenants.forEach((t) => {
      if (!t.property_id) return;
      if (!byProp[t.property_id]) {
        byProp[t.property_id] = {
          name: propName(t.property_id),
          expected: 0,
          collected: 0,
          tenantCount: 0,
          unpaidTenants: 0,
        };
      }
      byProp[t.property_id].expected += t.monthly_rent || 0;
      byProp[t.property_id].tenantCount += 1;
    });

    // Add collected payments for current month
    payments.forEach((p) => {
      if (p.status !== "Completed" || p.period !== currentMonth) return;
      const tenant = tenants.find((t) => t.id === p.tenant_id);
      const propId = tenant?.property_id || p.unit_id;
      if (propId && byProp[propId]) {
        byProp[propId].collected += p.amount || 0;
      }
    });

    // Calculate outstanding and unpaid tenants
    Object.values(byProp).forEach((d) => {
      d.outstanding = Math.max(0, d.expected - d.collected);
      d.collectionRate = d.expected > 0 ? Math.round((d.collected / d.expected) * 100) : 0;
      // Count unpaid tenants for this property
      const propTenants = tenants.filter((t) => t.property_id === Object.keys(byProp).find((k) => byProp[k] === d));
      const paidTenantIds = new Set(
        payments.filter((p) => p.period === currentMonth && p.status === "Completed").map((p) => p.tenant_id)
      );
      d.unpaidTenants = propTenants.filter((t) => !paidTenantIds.has(t.id)).length;
    });

    return Object.values(byProp).sort((a, b) => b.outstanding - a.outstanding);
  }, [payments, tenants, properties, currentMonth]);

  const totalExpected = propertyData.reduce((s, d) => s + d.expected, 0);
  const totalCollected = propertyData.reduce((s, d) => s + d.collected, 0);
  const totalOutstanding = propertyData.reduce((s, d) => s + d.outstanding, 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Ripoti ya Ukusanyaji wa Kodi</h2>
          <p className="text-xs text-slate-400 mt-0.5">Kodi iliyokusanywa dhidi ya kiasi ambacho hakijalipwa kwa mwezi {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Imelipwa
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-rose-400 rounded-full" /> Haijalipwa
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Inayostahili (Mwezi huu)</p>
              <p className="text-xl lg:text-2xl font-heading font-bold text-slate-900 mt-2">{formatTsh(totalExpected)}</p>
              <p className="text-xs text-slate-400 mt-1">{propertyData.length} nyumba</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Imekusanywa</p>
              <p className="text-xl lg:text-2xl font-heading font-bold text-emerald-600 mt-2">{formatTsh(totalCollected)}</p>
              <p className="text-xs text-slate-400 mt-1">{collectionRate}% ya kodi</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Haijalipwa</p>
              <p className="text-xl lg:text-2xl font-heading font-bold text-rose-600 mt-2">{formatTsh(totalOutstanding)}</p>
              <p className="text-xs text-slate-400 mt-1">{100 - collectionRate}% bado</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kiwango cha Ukusanyaji</p>
              <p className="text-xl lg:text-2xl font-heading font-bold text-slate-900 mt-2">{collectionRate}%</p>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-heading font-semibold text-slate-900 mb-4">Mwenendo wa Ukusanyaji wa Kodi (Miezi 6)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis tickFormatter={formatShort} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => formatTsh(v)}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              labelStyle={{ fontWeight: 600, color: "#1e293b" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
            <Bar dataKey="collected" name="Imekusanywa" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outstanding" name="Haijalipwa" fill="#fb7185" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-property breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-semibold text-slate-900">Kiasi Kisicholipwa kwa Nyumba</h3>
            <p className="text-xs text-slate-400 mt-0.5">Mwezi wa {monthLabel}</p>
          </div>
        </div>
        {propertyData.length === 0 ? (
          <p className="p-8 text-center text-slate-400">Hakuna data ya nyumba</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Nyumba</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Wapangaji</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Inayostahili</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Imekusanywa</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Haijalipwa</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-3">Kiwango</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {propertyData.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{d.tenantCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatTsh(d.expected)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatTsh(d.collected)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={d.outstanding > 0 ? "font-bold text-rose-600" : "text-slate-400"}>
                        {formatTsh(d.outstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${d.collectionRate >= 80 ? "bg-emerald-500" : d.collectionRate >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${d.collectionRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8">{d.collectionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-slate-900">Jumla</td>
                  <td className="px-4 py-3 text-right text-slate-700">{propertyData.reduce((s, d) => s + d.tenantCount, 0)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatTsh(totalExpected)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatTsh(totalCollected)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{formatTsh(totalOutstanding)}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{collectionRate}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}