import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Plus, Pencil, Trash2, X, Search, Receipt } from "lucide-react";
import { formatTsh, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [properties, setProperties] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [form, setForm] = useState({
    description: "", amount: 0, date: "", category: "Other",
    property_id: "", vendor: "", payment_method: "Cash",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [e, p] = await Promise.all([
        mysql.entities.Expense.list("-date", 500),
        mysql.entities.Property.list("-created_date", 500),
      ]);
      setExpenses(e);
      setProperties(p);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ description: "", amount: 0, date: new Date().toISOString().slice(0, 10), category: "Other", property_id: "", vendor: "", payment_method: "Cash" });
    setShowForm(true);
  }

  function openEdit(exp) {
    setEditing(exp);
    setForm({
      description: exp.description, amount: exp.amount, date: exp.date || "",
      category: exp.category, property_id: exp.property_id || "",
      vendor: exp.vendor || "", payment_method: exp.payment_method || "Cash",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, amount: parseInt(form.amount) || 0 };
    if (editing) {
      await mysql.entities.Expense.update(editing.id, payload);
    } else {
      await mysql.entities.Expense.create(payload);
      if (form.category === "Maintenance" || form.category === "Repairs") {
        await mysql.entities.MaintenanceRequest.create({
          title: form.description || `${form.category} expense`,
          description: `Expense of ${formatTsh(payload.amount)} recorded.\nVendor: ${form.vendor || "—"}\nPayment: ${form.payment_method}`,
          property_id: form.property_id || "",
          priority: "Medium",
          status: "Open",
          cost: payload.amount,
          reported_date: form.date || new Date().toISOString().slice(0, 10),
        });
      }
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(exp) {
    if (!confirm(`Delete expense "${exp.description}"?`)) return;
    await mysql.entities.Expense.delete(exp.id);
    loadData();
  }

  function propName(id) {
    const p = properties.find((x) => x.id === id);
    return p ? p.name : "—";
  }

  const categories = ["All", "Utilities", "Salaries", "Maintenance", "Repairs", "Supplies", "Security", "Cleaning", "Other"];
  const filtered = expenses.filter((e) => {
    const matchSearch = e.description?.toLowerCase().includes(search.toLowerCase()) || e.vendor?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);

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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track operational costs — utilities, salaries, repairs & more</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Expenses</p>
          <p className="text-2xl font-heading font-bold text-rose-600 mt-2">{formatTsh(total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Records</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">This Month</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">
            {formatTsh(filtered.filter((e) => e.date && e.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, e) => s + (e.amount || 0), 0))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map((c) => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filterCat === c ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No expenses recorded.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Description</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Category</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Property</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Vendor</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{e.description}</td>
                    <td className="px-4 py-3"><span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700">{e.category}</span></td>
                    <td className="px-4 py-3 text-slate-600">{propName(e.property_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{e.vendor || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-rose-600">{formatTsh(e.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                        <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5 text-rose-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan="5" className="px-4 py-3 font-medium text-slate-700 text-right">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatTsh(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-lg text-slate-900">{editing ? "Edit Expense" : "New Expense"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Description *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount (Tsh) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} required className="mt-1" />
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category *</Label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Utilities</option><option>Salaries</option><option>Maintenance</option>
                    <option>Repairs</option><option>Supplies</option><option>Security</option>
                    <option>Cleaning</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <Label>Property</Label>
                  <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select property</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vendor / Payee</Label>
                  <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>M-Pesa</option><option>Tigo Pesa</option><option>Airtel Money</option><option>Cash</option><option>Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">{editing ? "Save Changes" : "Add Expense"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}