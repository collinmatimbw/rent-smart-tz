import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate } from "@/lib/format";
import { Zap, Droplet, Flame, Wifi, Plus, X, CheckCircle2, Search, Pencil, Trash2 } from "lucide-react";

const UTILITY_TYPES = [
  { key: "Electricity", icon: Zap, color: "text-yellow-600", bg: "bg-yellow-50" },
  { key: "Water", icon: Droplet, color: "text-cyan-600", bg: "bg-cyan-50" },
  { key: "Gas", icon: Flame, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "Internet", icon: Wifi, color: "text-indigo-600", bg: "bg-indigo-50" },
];

function typeMeta(type) {
  return UTILITY_TYPES.find((t) => t.key === type) || UTILITY_TYPES[0];
}

export default function Utilities() {
  const [loading, setLoading] = useState(true);
  const [utilities, setUtilities] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    property_id: "",
    unit_id: "",
    utility_type: "Electricity",
    previous_reading: 0,
    current_reading: 0,
    rate: 0,
    reading_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [utils, props, uns] = await Promise.all([
        mysql.entities.Utility.list("-reading_date", 500),
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
      ]);
      setUtilities(utils);
      setProperties(props);
      setUnits(uns);
    } finally {
      setLoading(false);
    }
  }

  function propName(id) {
    return properties.find((p) => p.id === id)?.name || "—";
  }
  function unitNumber(id) {
    return units.find((u) => u.id === id)?.unit_number || "—";
  }

  async function handlePropertyChange(propId) {
    const propUnits = units.filter((u) => u.property_id === propId);
    const lastReading = utilities
      .filter((u) => u.property_id === propId)
      .sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
    setForm({
      ...form,
      property_id: propId,
      unit_id: propUnits[0]?.id || "",
      previous_reading: lastReading?.current_reading || 0,
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({
      property_id: "",
      unit_id: "",
      utility_type: "Electricity",
      previous_reading: 0,
      current_reading: 0,
      rate: 0,
      reading_date: new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      property_id: u.property_id || "",
      unit_id: u.unit_id || "",
      utility_type: u.utility_type || "Electricity",
      previous_reading: u.previous_reading || 0,
      current_reading: u.current_reading || 0,
      rate: u.rate || 0,
      reading_date: u.reading_date || new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const consumption = Math.max(0, Number(form.current_reading) - Number(form.previous_reading));
    const amount = consumption * Number(form.rate);
    const period = form.reading_date.slice(0, 7);
    const payload = {
      property_id: form.property_id,
      unit_id: form.unit_id,
      utility_type: form.utility_type,
      previous_reading: Number(form.previous_reading),
      current_reading: Number(form.current_reading),
      consumption,
      rate: Number(form.rate),
      amount,
      reading_date: form.reading_date,
      period,
    };
    if (editing) {
      await mysql.entities.Utility.update(editing.id, payload);
    } else {
      await mysql.entities.Utility.create({ ...payload, status: "Unpaid" });
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(u) {
    if (!confirm(`Delete this ${u.utility_type} reading?`)) return;
    await mysql.entities.Utility.delete(u.id);
    loadData();
  }

  async function markPaid(id) {
    await mysql.entities.Utility.update(id, { status: "Paid" });
    loadData();
  }

  const filtered = utilities.filter((u) => {
    if (filterProperty !== "all" && u.property_id !== filterProperty) return false;
    if (filterType !== "all" && u.utility_type !== filterType) return false;
    if (search) {
      const prop = propName(u.property_id).toLowerCase();
      const unit = unitNumber(u.unit_id).toLowerCase();
      if (!prop.includes(search.toLowerCase()) && !unit.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const summaryByType = UTILITY_TYPES.map((t) => ({
    ...t,
    unpaid: utilities.filter((u) => u.utility_type === t.key && u.status === "Unpaid").reduce((s, u) => s + (u.amount || 0), 0),
    count: utilities.filter((u) => u.utility_type === t.key && u.status === "Unpaid").length,
  }));

  const filteredUnits = form.property_id ? units.filter((u) => u.property_id === form.property_id) : [];

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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Utility Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track meter readings and utility bills</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> Add Reading
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryByType.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.key} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">{t.key}</p>
                  <p className="text-xl font-heading font-bold text-slate-900 mt-2">{formatTsh(t.unpaid)}</p>
                  <p className="text-xs text-slate-400 mt-1">{t.count} unpaid bills</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${t.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${t.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property or unit..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="all">All Properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="all">All Types</option>
          {UTILITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.key}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Property</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Unit</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Type</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Prev</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Current</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Used</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Rate</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Amount</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Date</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Status</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center text-slate-400 py-8">No utility readings found</td></tr>
              ) : filtered.map((u) => {
                const meta = typeMeta(u.utility_type);
                const Icon = meta.icon;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{propName(u.property_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{unitNumber(u.unit_id)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-700">
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} /> {u.utility_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{(u.previous_reading || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{(u.current_reading || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{(u.consumption || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatTsh(u.rate)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatTsh(u.amount)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(u.reading_date)}</td>
                    <td className="px-4 py-3 text-center">
                      {u.status === "Paid" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Paid
                        </span>
                      ) : (
                        <button onClick={() => markPaid(u.id)} className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200">
                          Mark Paid
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg hover:bg-rose-50" title="Delete">
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Reading Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-heading font-semibold text-slate-900">{editing ? "Edit Reading" : "Add Meter Reading"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Property</label>
                <select required value={form.property_id} onChange={(e) => handlePropertyChange(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">Select property</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Unit</label>
                <select required value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">Select unit</option>
                  {filteredUnits.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Utility Type</label>
                  <select value={form.utility_type} onChange={(e) => setForm({ ...form, utility_type: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {UTILITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.key}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Reading Date</label>
                  <input type="date" required value={form.reading_date} onChange={(e) => setForm({ ...form, reading_date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Prev Reading</label>
                  <input type="number" value={form.previous_reading} onChange={(e) => setForm({ ...form, previous_reading: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Current Reading</label>
                  <input type="number" required value={form.current_reading} onChange={(e) => setForm({ ...form, current_reading: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Rate / Unit</label>
                  <input type="number" required value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              {Number(form.current_reading) > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                  Consumption: <b className="text-slate-900">{Math.max(0, Number(form.current_reading) - Number(form.previous_reading)).toLocaleString()}</b> units × {formatTsh(Number(form.rate))} = <b className="text-slate-900">{formatTsh(Math.max(0, Number(form.current_reading) - Number(form.previous_reading)) * Number(form.rate))}</b>
                </div>
              )}
              <button type="submit" className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                {editing ? "Save Changes" : "Save Reading"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
