import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Plus, Wallet, X, Search, Pencil, Trash2, AlertCircle } from "lucide-react";
import { formatTsh, statusColor, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [overpaymentInfo, setOverpaymentInfo] = useState(null);
  const [form, setForm] = useState({
    tenant_id: "", unit_id: "", amount: 0, payment_date: new Date().toISOString().slice(0, 10),
    method: "M-Pesa", period: "", reference: "", status: "Completed",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [pays, t, u] = await Promise.all([
        mysql.entities.Payment.list("-created_date", 500),
        mysql.entities.Tenant.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
      ]);
      setPayments(pays);
      setTenants(t);
      setUnits(u);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setEditing(null);
    setForm({ tenant_id: "", unit_id: "", amount: 0, payment_date: now.toISOString().slice(0, 10), method: "M-Pesa", period, reference: "", status: "Completed" });
    setOverpaymentInfo(null);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      tenant_id: p.tenant_id,
      unit_id: p.unit_id || "",
      amount: p.amount,
      payment_date: p.payment_date,
      method: p.method,
      period: p.period || "",
      reference: p.reference || "",
      status: p.status,
    });
    setOverpaymentInfo(null);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const tenant = tenants.find((t) => t.id === form.tenant_id);
    const payload = {
      ...form,
      unit_id: form.unit_id || (tenant ? tenant.unit_id : ""),
      amount: parseInt(form.amount) || 0,
    };

    if (editing) {
      await mysql.entities.Payment.update(editing.id, payload);
    } else {
      await mysql.entities.Payment.create(payload);
    }

    if (tenant && form.status === "Completed") {
      const balance = tenant.balance || 0;
      const newBalance = balance - payload.amount;
      await mysql.entities.Tenant.update(tenant.id, { balance: newBalance });
      if (newBalance < 0) {
        setOverpaymentInfo({ tenant: tenant.full_name, amount: Math.abs(newBalance) });
      }
    }

    setShowForm(false);
    loadData();
  }

  async function handleDelete(p) {
    if (!confirm(`Delete this payment of ${formatTsh(p.amount)}?`)) return;
    await mysql.entities.Payment.delete(p.id);
    if (p.status === "Completed") {
      const tenant = tenants.find((t) => t.id === p.tenant_id);
      if (tenant) {
        const newBalance = (tenant.balance || 0) + p.amount;
        await mysql.entities.Tenant.update(tenant.id, { balance: newBalance });
      }
    }
    loadData();
  }

  function tenantName(id) {
    const t = tenants.find((x) => x.id === id);
    return t ? t.full_name : "—";
  }

  function unitLabel(id) {
    const u = units.find((x) => x.id === id);
    return u ? u.unit_number : "—";
  }

  const filtered = payments.filter((p) =>
    tenantName(p.tenant_id).toLowerCase().includes(search.toLowerCase()) || p.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCollected = payments.filter((p) => p.status === "Completed").reduce((s, p) => s + (p.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-1">Track rent payments and collections</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      {overpaymentInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">Overpayment recorded</p>
            <p className="text-sm text-blue-700">
              {overpaymentInfo.tenant} overpaid by {formatTsh(overpaymentInfo.amount)}. This amount covers next month's rent.
            </p>
          </div>
          <button onClick={() => setOverpaymentInfo(null)} className="ml-auto text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Collected</p>
          <p className="text-2xl font-heading font-bold text-emerald-600 mt-2">{formatTsh(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Payments</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{payments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-heading font-bold text-amber-600 mt-2">{payments.filter((p) => p.status === "Pending").length}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Search by tenant or ref..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Tenant</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Unit</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Amount</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Method</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Period</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{tenantName(p.tenant_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{unitLabel(p.unit_id)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatTsh(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.method}</td>
                    <td className="px-4 py-3 text-slate-500">{p.period || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-rose-50" title="Delete">
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-lg text-slate-900">{editing ? "Edit Payment" : "Record Payment"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Tenant *</Label>
                <select value={form.tenant_id} onChange={(e) => {
                  const t = tenants.find((x) => x.id === e.target.value);
                  setForm({ ...form, tenant_id: e.target.value, amount: t?.monthly_rent || form.amount, unit_id: t?.unit_id || "" });
                }} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select tenant</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount (Tsh) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} required className="mt-1" />
                </div>
                <div>
                  <Label>Method</Label>
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>M-Pesa</option>
                    <option>Tigo Pesa</option>
                    <option>Airtel Money</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Payment Date *</Label>
                  <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required className="mt-1" />
                </div>
                <div>
                  <Label>Period (YYYY-MM)</Label>
                  <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-07" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Reference</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Receipt / Txn ID" className="mt-1" />
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Completed</option>
                    <option>Pending</option>
                    <option>Failed</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">{editing ? "Save Changes" : "Record Payment"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
