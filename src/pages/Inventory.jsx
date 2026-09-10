import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh } from "@/lib/format";
import { Plus, X, Search, Pencil, Trash2, AlertTriangle, XCircle } from "lucide-react";

const CATEGORIES = ["Furniture", "Appliance", "Electronics", "Fixture", "Other"];
const CONDITIONS = ["Good", "Damaged", "Missing"];

function conditionBadge(c) {
  if (c === "Good") return "bg-emerald-100 text-emerald-700";
  if (c === "Damaged") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function Inventory() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [form, setForm] = useState({
    property_id: "",
    unit_id: "",
    item_name: "",
    category: "Furniture",
    quantity: 1,
    condition: "Good",
    value: 0,
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [inv, props, uns] = await Promise.all([
        mysql.entities.Inventory.list("-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
      ]);
      setItems(inv);
      setProperties(props);
      setUnits(uns);
    } finally {
      setLoading(false);
    }
  }

  function propName(id) { return properties.find((p) => p.id === id)?.name || "—"; }
  function unitNumber(id) { return units.find((u) => u.id === id)?.unit_number || "—"; }

  function openAdd() {
    setEditing(null);
    setForm({ property_id: "", unit_id: "", item_name: "", category: "Furniture", quantity: 1, condition: "Good", value: 0, notes: "" });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...item });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const data = { ...form, quantity: Number(form.quantity), value: Number(form.value) };
    if (editing) {
      await mysql.entities.Inventory.update(editing.id, data);
    } else {
      await mysql.entities.Inventory.create(data);
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id) {
    await mysql.entities.Inventory.delete(id);
    loadData();
  }

  const filtered = items.filter((it) => {
    if (filterProp !== "all" && it.property_id !== filterProp) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!it.item_name?.toLowerCase().includes(q) && !propName(it.property_id).toLowerCase().includes(q) && !unitNumber(it.unit_id).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalValue = items.reduce((s, it) => s + (it.value || 0) * (it.quantity || 1), 0);
  const damaged = items.filter((it) => it.condition === "Damaged").length;
  const missing = items.filter((it) => it.condition === "Missing").length;
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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Track furniture, appliances & fixtures per unit</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Items</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{items.reduce((s, it) => s + (it.quantity || 1), 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Value</p>
          <p className="text-xl font-heading font-bold text-slate-900 mt-2">{formatTsh(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Damaged</p>
          <div className="flex items-center gap-2 mt-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <p className="text-2xl font-heading font-bold text-slate-900">{damaged}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Missing</p>
          <div className="flex items-center gap-2 mt-2">
            <XCircle className="w-5 h-5 text-rose-500" />
            <p className="text-2xl font-heading font-bold text-slate-900">{missing}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="all">All Properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Item</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Category</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Property</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Unit</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Qty</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Value</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Condition</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8">No inventory items found</td></tr>
              ) : filtered.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{it.item_name}</td>
                  <td className="px-4 py-3 text-slate-600">{it.category}</td>
                  <td className="px-4 py-3 text-slate-600">{propName(it.property_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{unitNumber(it.unit_id)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{it.quantity || 1}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatTsh(it.value)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${conditionBadge(it.condition)}`}>{it.condition}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(it)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => handleDelete(it.id)} className="p-1.5 rounded-lg hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5 text-rose-500" /></button>
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
              <h3 className="font-heading font-semibold text-slate-900">{editing ? "Edit Item" : "Add Inventory Item"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Property</label>
                <select required value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value, unit_id: "" })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">Select property</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Unit</label>
                <select value={form.unit_id || ""} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">No specific unit</option>
                  {filteredUnits.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Item Name</label>
                  <input required value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. Sofa, Fridge, TV" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Quantity</label>
                  <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Value (Tsh)</label>
                  <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Condition</label>
                  <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Optional notes..." />
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                {editing ? "Update Item" : "Add Item"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}