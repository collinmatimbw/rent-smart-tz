import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Plus, Wrench, X, Pencil, Trash2, MapPin, User, Calendar, WrenchIcon, Banknote } from "lucide-react";
import { formatTsh, statusColor, priorityColor, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Maintenance() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({
    unit_id: "", property_id: "", tenant_id: "", title: "", description: "",
    priority: "Medium", status: "Open", assigned_technician: "", cost: 0,
    reported_date: new Date().toISOString().slice(0, 10), resolved_date: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [r, u, p, t] = await Promise.all([
        mysql.entities.MaintenanceRequest.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Tenant.list("-created_date", 500),
      ]);
      setRequests(r);
      setUnits(u);
      setProperties(p);
      setTenants(t);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ unit_id: "", property_id: "", tenant_id: "", title: "", description: "", priority: "Medium", status: "Open", assigned_technician: "", cost: 0, reported_date: new Date().toISOString().slice(0, 10), resolved_date: "" });
    setShowForm(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({
      unit_id: r.unit_id || "",
      property_id: r.property_id || "",
      tenant_id: r.tenant_id || "",
      title: r.title || "",
      description: r.description || "",
      priority: r.priority || "Medium",
      status: r.status || "Open",
      assigned_technician: r.assigned_technician || "",
      cost: r.cost || 0,
      reported_date: r.reported_date || new Date().toISOString().slice(0, 10),
      resolved_date: r.resolved_date || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const unit = units.find((u) => u.id === form.unit_id);
    const payload = {
      ...form,
      property_id: form.property_id || (unit ? unit.property_id : ""),
      cost: parseInt(form.cost) || 0,
    };
    if (editing) {
      await mysql.entities.MaintenanceRequest.update(editing.id, payload);
    } else {
      await mysql.entities.MaintenanceRequest.create(payload);
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(r) {
    if (!confirm(`Delete maintenance request "${r.title}"?`)) return;
    await mysql.entities.MaintenanceRequest.delete(r.id);
    loadData();
  }

  async function updateStatus(req, status) {
    const updates = { status };
    if (status === "Resolved" || status === "Closed") {
      updates.resolved_date = new Date().toISOString().slice(0, 10);
    }
    await mysql.entities.MaintenanceRequest.update(req.id, updates);
    loadData();
  }

  function unitLabel(id) {
    const u = units.find((x) => x.id === id);
    return u ? `Unit ${u.unit_number}` : "—";
  }

  function tenantName(id) {
    const t = tenants.find((x) => x.id === id);
    return t ? t.full_name : "—";
  }

  const statusFilters = ["All", "Open", "In Progress", "Assigned", "Resolved", "Closed"];
  const filtered = filter === "All" ? requests : requests.filter((r) => r.status === filter);

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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Maintenance</h1>
          <p className="text-sm text-slate-500 mt-1">Track and resolve maintenance requests</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Request
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s}
            {s !== "All" && (
              <span className="ml-1.5 text-xs opacity-70">({requests.filter((r) => r.status === s).length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No maintenance requests in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-slate-900">{r.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor(r.priority)}`}>{r.priority}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span>
                  </div>
                  {r.description && <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{r.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {unitLabel(r.unit_id)}</span>
                    <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {tenantName(r.tenant_id)}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(r.reported_date)}</span>
                    {r.assigned_technician && <span className="inline-flex items-center gap-1"><WrenchIcon className="w-3 h-3" /> {r.assigned_technician}</span>}
                    {r.cost > 0 && <span className="inline-flex items-center gap-1"><Banknote className="w-3 h-3" /> {formatTsh(r.cost)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg hover:bg-rose-50" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                  {r.status !== "Resolved" && r.status !== "Closed" && (
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r, e.target.value)}
                      className="text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white ml-1"
                    >
                      <option>Open</option>
                      <option>In Progress</option>
                      <option>Assigned</option>
                      <option>Resolved</option>
                      <option>Closed</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-lg text-slate-900">{editing ? "Edit Request" : "New Maintenance Request"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Issue Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Leaking faucet" className="mt-1" />
              </div>
              <div>
                <Label>Description</Label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Property</Label>
                  <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select property</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Unit *</Label>
                  <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select unit</option>
                    {units.filter((u) => !form.property_id || u.property_id === form.property_id).map((u) => (
                      <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>Reported By (Tenant)</Label>
                <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select tenant (optional)</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
                <div>
                  <Label>Reported Date</Label>
                  <Input type="date" value={form.reported_date} onChange={(e) => setForm({ ...form, reported_date: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Assigned Technician</Label>
                  <Input value={form.assigned_technician} onChange={(e) => setForm({ ...form, assigned_technician: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Cost (Tsh)</Label>
                  <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseInt(e.target.value) || 0 })} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">{editing ? "Save Changes" : "Create Request"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
