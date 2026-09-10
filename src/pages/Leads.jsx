import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate } from "@/lib/format";
import { UserPlus, Pencil, Trash2, X, Search, Phone, TrendingUp, UserCheck } from "lucide-react";

const STATUSES = ["New", "Contacted", "Visited", "Converted", "Lost"];
const SOURCES = ["Walk-in", "Phone", "Online", "Referral", "Social Media"];
const UNIT_TYPES = ["Bedsitter", "1BR", "2BR", "3BR", "Shop", "Office"];

function statusBadge(s) {
  const map = {
    New: "bg-blue-100 text-blue-700",
    Contacted: "bg-indigo-100 text-indigo-700",
    Visited: "bg-amber-100 text-amber-700",
    Converted: "bg-emerald-100 text-emerald-700",
    Lost: "bg-rose-100 text-rose-700",
  };
  return map[s] || "bg-slate-100 text-slate-600";
}

export default function Leads() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", interested_property_id: "",
    preferred_unit_type: "1BR", budget: 0, source: "Walk-in",
    status: "New", notes: "", follow_up_date: "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [lds, props] = await Promise.all([
        mysql.entities.Lead.list("-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
      ]);
      setLeads(lds);
      setProperties(props);
    } finally {
      setLoading(false);
    }
  }

  function propName(id) { return properties.find((p) => p.id === id)?.name || "—"; }

  function openAdd() {
    setEditing(null);
    setForm({ full_name: "", phone: "", email: "", interested_property_id: "", preferred_unit_type: "1BR", budget: 0, source: "Walk-in", status: "New", notes: "", follow_up_date: "" });
    setShowForm(true);
  }

  function openEdit(lead) {
    setEditing(lead);
    setForm({ ...lead });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const data = { ...form, budget: Number(form.budget) };
    if (editing) {
      await mysql.entities.Lead.update(editing.id, data);
    } else {
      await mysql.entities.Lead.create(data);
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id) {
    await mysql.entities.Lead.delete(id);
    loadData();
  }

  async function changeStatus(id, status) {
    await mysql.entities.Lead.update(id, { status });
    loadData();
  }

  const filtered = leads.filter((l) => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.full_name?.toLowerCase().includes(q) && !(l.phone || "").includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === "New").length,
    converted: leads.filter((l) => l.status === "Converted").length,
    lost: leads.filter((l) => l.status === "Lost").length,
  };
  const conversionRate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-indigo-500" /> Lead Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track potential tenants and conversions</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
          <UserPlus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-slate-400" /><p className="text-xs font-medium text-slate-500 uppercase">Total Leads</p></div>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-400" /><p className="text-xs font-medium text-slate-500 uppercase">New</p></div>
          <p className="text-2xl font-heading font-bold text-blue-600 mt-2">{stats.new}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-400" /><p className="text-xs font-medium text-slate-500 uppercase">Converted</p></div>
          <p className="text-2xl font-heading font-bold text-emerald-600 mt-2">{stats.converted}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400" /><p className="text-xs font-medium text-slate-500 uppercase">Conversion Rate</p></div>
          <p className="text-2xl font-heading font-bold text-indigo-600 mt-2">{conversionRate}%</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Name</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Contact</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Interested In</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Budget</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Source</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Follow-up</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Status</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8">No leads found</td></tr>
              ) : filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{l.full_name}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-600">{l.phone}</p>
                    {l.email && <p className="text-xs text-slate-400">{l.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-600">{propName(l.interested_property_id)}</p>
                    <p className="text-xs text-slate-400">{l.preferred_unit_type}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatTsh(l.budget)}</td>
                  <td className="px-4 py-3 text-slate-600">{l.source}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(l.follow_up_date)}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={l.status}
                      onChange={(e) => changeStatus(l.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusBadge(l.status)}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded-lg hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5 text-rose-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-heading font-semibold text-slate-900">{editing ? "Edit Lead" : "Add Lead"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Budget (Tsh)</label>
                  <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Interested Property</label>
                  <select value={form.interested_property_id || ""} onChange={(e) => setForm({ ...form, interested_property_id: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="">None</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Preferred Unit Type</label>
                  <select value={form.preferred_unit_type} onChange={(e) => setForm({ ...form, preferred_unit_type: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Follow-up Date</label>
                <input type="date" value={form.follow_up_date || ""} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                {editing ? "Update Lead" : "Add Lead"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}