import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate } from "@/lib/format";
import { Percent, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function Penalties() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [penalties, setPenalties] = useState([]);
  const [applying, setApplying] = useState(false);
  const [appliedIds, setAppliedIds] = useState(new Set());

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tensRes, paysRes, pensRes] = await Promise.allSettled([
        mysql.entities.Tenant.filter({ status: "Active" }, "-created_date", 500),
        mysql.entities.Payment.list("-created_date", 500),
        mysql.entities.Penalty.list("-date_applied", 500),
      ]);
      const tens = tensRes.status === "fulfilled" ? tensRes.value : [];
      const pays = paysRes.status === "fulfilled" ? paysRes.value : [];
      const pens = pensRes.status === "fulfilled" ? pensRes.value : [];
      setTenants(tens);
      setPayments(pays);
      setPenalties(pens);

      const applied = new Set(
        pens
          .filter((p) => p.period === currentMonth && p.status === "Applied")
          .map((p) => p.tenant_id)
      );
      setAppliedIds(applied);
    } finally {
      setLoading(false);
    }
  }

  const paidTenantIds = new Set(
    payments
      .filter((p) => p.period === currentMonth && p.status === "Completed")
      .map((p) => p.tenant_id)
  );

  const overdueTenants = tenants.filter((t) => !paidTenantIds.has(t.id));
  const totalPenalty = overdueTenants
    .filter((t) => !appliedIds.has(t.id))
    .reduce((s, t) => s + Math.round((t.monthly_rent || 0) * 0.05), 0);

  async function applyPenalty(tenant) {
    setApplying(true);
    try {
      const penaltyAmount = Math.round((tenant.monthly_rent || 0) * 0.05);
      await mysql.entities.Penalty.create({
        tenant_id: tenant.id,
        amount: penaltyAmount,
        base_rent: tenant.monthly_rent,
        period: currentMonth,
        date_applied: today,
        status: "Applied",
      });
      await mysql.entities.Tenant.update(tenant.id, {
        balance: (tenant.balance || 0) + penaltyAmount,
      });
      loadData();
    } finally {
      setApplying(false);
    }
  }

  async function applyAll() {
    setApplying(true);
    try {
      const pending = overdueTenants.filter((t) => !appliedIds.has(t.id));
      for (const t of pending) {
        const penaltyAmount = Math.round((t.monthly_rent || 0) * 0.05);
        await mysql.entities.Penalty.create({
          tenant_id: t.id,
          amount: penaltyAmount,
          base_rent: t.monthly_rent,
          period: currentMonth,
          date_applied: today,
          status: "Applied",
        });
        await mysql.entities.Tenant.update(t.id, {
          balance: (t.balance || 0) + penaltyAmount,
        });
      }
      loadData();
    } finally {
      setApplying(false);
    }
  }

  async function waivePenalty(penaltyId, tenant) {
    await mysql.entities.Penalty.update(penaltyId, { status: "Waived" });
    if (tenant) {
      const penalty = penalties.find((p) => p.id === penaltyId);
      if (penalty) {
        await mysql.entities.Tenant.update(tenant.id, {
          balance: Math.max(0, (tenant.balance || 0) - penalty.amount),
        });
      }
    }
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  const thisMonthPenalties = penalties.filter((p) => p.period === currentMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            <Percent className="w-6 h-6 text-rose-500" /> Penalty Automation
          </h1>
          <p className="text-sm text-slate-500 mt-1">Auto 5% late fee for unpaid rent — {currentMonth}</p>
        </div>
        {overdueTenants.filter((t) => !appliedIds.has(t.id)).length > 0 && (
          <button
            onClick={applyAll}
            disabled={applying}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" /> Apply All Penalties ({overdueTenants.filter((t) => !appliedIds.has(t.id)).length})
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Overdue Tenants</p>
          <p className="text-2xl font-heading font-bold text-rose-600 mt-2">{overdueTenants.filter((t) => !appliedIds.has(t.id)).length}</p>
          <p className="text-xs text-slate-400 mt-1">Haven't paid this month</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Penalty Pending</p>
          <p className="text-2xl font-heading font-bold text-amber-600 mt-2">{formatTsh(totalPenalty)}</p>
          <p className="text-xs text-slate-400 mt-1">5% of monthly rent each</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Applied This Month</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{thisMonthPenalties.filter((p) => p.status === "Applied").length}</p>
          <p className="text-xs text-slate-400 mt-1">{formatTsh(thisMonthPenalties.filter((p) => p.status === "Applied").reduce((s, p) => s + p.amount, 0))} charged</p>
        </div>
      </div>

      {/* Overdue list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-heading font-semibold text-slate-900">Overdue Tenants — {currentMonth}</h3>
        </div>
        {overdueTenants.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm text-slate-600 mt-3 font-medium">All tenants have paid this month!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Tenant</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Phone</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Monthly Rent</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Current Balance</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Penalty (5%)</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {overdueTenants.map((t) => {
                  const penaltyAmount = Math.round((t.monthly_rent || 0) * 0.05);
                  const applied = appliedIds.has(t.id);
                  const penaltyRecord = thisMonthPenalties.find((p) => p.tenant_id === t.id && p.status === "Applied");
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{t.phone || "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatTsh(t.monthly_rent)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatTsh(t.balance || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-rose-600">{formatTsh(penaltyAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        {applied ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-rose-100 text-rose-700">
                              <CheckCircle2 className="w-3 h-3" /> Applied
                            </span>
                            {penaltyRecord && (
                              <button onClick={() => waivePenalty(penaltyRecord.id, t)} className="text-xs text-slate-500 hover:text-slate-900 underline">
                                Waive
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => applyPenalty(t)}
                            disabled={applying}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Penalty history */}
      {thisMonthPenalties.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-slate-900">Penalty History — {currentMonth}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Tenant</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Base Rent</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Penalty</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Date</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {thisMonthPenalties.map((p) => {
                  const tenant = tenants.find((t) => t.id === p.tenant_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{tenant?.full_name || "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatTsh(p.base_rent)}</td>
                      <td className="px-4 py-3 text-right font-medium text-rose-600">{formatTsh(p.amount)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(p.date_applied)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.status === "Applied" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}