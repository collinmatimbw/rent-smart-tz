import React, { useEffect, useState, useMemo } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh } from "@/lib/format";
import { Building2, TrendingUp, Wallet, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function CashFlow() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [pays, props, tens, uns] = await Promise.all([
        mysql.entities.Payment.list("-created_date", 2000),
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Tenant.list("-created_date", 2000),
        mysql.entities.Unit.list("-created_date", 2000),
      ]);
      setPayments(pays);
      setProperties(props);
      setTenants(tens);
      setUnits(uns);
    } finally {
      setLoading(false);
    }
  }

  // Map tenant_id → property_id
  const tenantPropertyMap = useMemo(() => {
    const map = {};
    tenants.forEach((t) => { map[t.id] = t.property_id; });
    return map;
  }, [tenants]);

  // Available months from payment periods
  const availableMonths = useMemo(() => {
    const set = new Set();
    payments.forEach((p) => p.period && set.add(p.period));
    set.add(new Date().toISOString().slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [payments]);

  // Last 6 months for trend
  const last6Months = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
      });
    }
    return months;
  }, []);

  // Per-property data for selected month
  const propertyData = useMemo(() => {
    const monthPayments = payments.filter((p) => p.period === selectedMonth && p.status === "Completed");

    return properties.map((prop) => {
      const propUnits = units.filter((u) => u.property_id === prop.id);
      const propTenants = tenants.filter((t) => t.property_id === prop.id && t.status === "Active");
      const expectedRent = propTenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);

      // Payments for this property this month (via tenant → property mapping)
      const propPayments = monthPayments.filter((p) => tenantPropertyMap[p.tenant_id] === prop.id);
      const collected = propPayments.reduce((s, p) => s + (p.amount || 0), 0);

      // Outstanding: active tenants' balances + (expected - collected if not fully paid)
      const outstandingBalances = propTenants.reduce((s, t) => s + (t.balance || 0), 0);
      const unpaid = Math.max(0, expectedRent - collected);

      const collectionRate = expectedRent > 0 ? Math.round((collected / expectedRent) * 100) : 0;

      return {
        property: prop,
        unitCount: propUnits.length,
        tenantCount: propTenants.length,
        expectedRent,
        collected,
        unpaid,
        outstandingBalances,
        collectionRate,
      };
    });
  }, [properties, units, tenants, payments, selectedMonth, tenantPropertyMap]);

  // Per-property 6-month trend for chart
  const trendByProperty = useMemo(() => {
    return properties.map((prop) => {
      const monthly = last6Months.map((m) => {
        const collected = payments
          .filter((p) => p.period === m.key && p.status === "Completed" && tenantPropertyMap[p.tenant_id] === prop.id)
          .reduce((s, p) => s + (p.amount || 0), 0);
        return { month: m.label, collected };
      });
      return { property: prop, monthly };
    });
  }, [properties, payments, tenantPropertyMap, last6Months]);

  // Combined monthly trend (all properties)
  const combinedTrend = useMemo(() => {
    return last6Months.map((m) => {
      const collected = payments
        .filter((p) => p.period === m.key && p.status === "Completed")
        .reduce((s, p) => s + (p.amount || 0), 0);
      const expected = tenants
        .filter((t) => t.status === "Active")
        .reduce((s, t) => s + (t.monthly_rent || 0), 0);
      return { month: m.label, Collected: collected, Expected: expected };
    });
  }, [payments, tenants, last6Months]);

  const totals = useMemo(() => {
    const totalExpected = propertyData.reduce((s, p) => s + p.expectedRent, 0);
    const totalCollected = propertyData.reduce((s, p) => s + p.collected, 0);
    const totalUnpaid = propertyData.reduce((s, p) => s + p.unpaid, 0);
    const overallRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    return { totalExpected, totalCollected, totalUnpaid, overallRate };
  }, [propertyData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Collected", value: formatTsh(totals.totalCollected), icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Expected Rent", value: formatTsh(totals.totalExpected), icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Outstanding", value: formatTsh(totals.totalUnpaid), icon: Building2, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Collection Rate", value: totals.overallRate + "%", icon: Percent, color: "text-slate-900", bg: "bg-slate-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Cash Flow Report</h1>
          <p className="text-sm text-slate-500 mt-1">Rent collected per property — monthly cash flow at a glance</p>
        </div>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
          {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6-month combined trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-heading font-semibold text-slate-900 mb-4">6-Month Collection Trend (All Properties)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={combinedTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatTsh(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
            <Legend />
            <Bar dataKey="Expected" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-property table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-heading font-semibold text-slate-900">Rent Collected by Property — {selectedMonth}</h3>
        </div>
        {propertyData.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No properties found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Property</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-3">Units</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-3">Tenants</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Expected</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Collected</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Outstanding</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-3">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {propertyData.map((row) => (
                  <tr key={row.property.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.property.name}</p>
                      <p className="text-xs text-slate-400">{row.property.address}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.unitCount}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.tenantCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatTsh(row.expectedRent)}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatTsh(row.collected)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatTsh(row.unpaid)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.collectionRate >= 80 ? "bg-emerald-500" : row.collectionRate >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(row.collectionRate, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 w-8">{row.collectionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-900" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatTsh(totals.totalExpected)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatTsh(totals.totalCollected)}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-600">{formatTsh(totals.totalUnpaid)}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">{totals.overallRate}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}