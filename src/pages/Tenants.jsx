import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Plus, Users, Pencil, Trash2, X, Search, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { formatTsh, statusColor, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Tenants() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", unit_id: "", property_id: "",
    lease_start: "", lease_end: "", monthly_rent: 0, balance: 0, status: "Active",
    nida_number: "", passport_number: "", tin_number: "",
    employer: "", employer_phone: "",
    next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relation: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [t, u, p] = await Promise.all([
        mysql.entities.Tenant.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
      ]);
      setTenants(t);
      setUnits(u);
      setProperties(p);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ full_name: "", phone: "", email: "", unit_id: "", property_id: "", lease_start: "", lease_end: "", monthly_rent: 0, balance: 0, status: "Active", nida_number: "", passport_number: "", tin_number: "", employer: "", employer_phone: "", next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relation: "" });
    setShowForm(true);
  }

  function openEdit(tenant) {
    setEditing(tenant);
    setForm({
      full_name: tenant.full_name, phone: tenant.phone, email: tenant.email || "",
      unit_id: tenant.unit_id || "", property_id: tenant.property_id || "",
      lease_start: tenant.lease_start || "", lease_end: tenant.lease_end || "",
      monthly_rent: tenant.monthly_rent || 0, balance: tenant.balance || 0, status: tenant.status,
      nida_number: tenant.nida_number || "", passport_number: tenant.passport_number || "",
      tin_number: tenant.tin_number || "", employer: tenant.employer || "",
      employer_phone: tenant.employer_phone || "",
      next_of_kin_name: tenant.next_of_kin_name || "", next_of_kin_phone: tenant.next_of_kin_phone || "",
      next_of_kin_relation: tenant.next_of_kin_relation || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const selectedUnit = units.find((u) => u.id === form.unit_id);
    const payload = {
      ...form,
      monthly_rent: form.monthly_rent || (selectedUnit ? selectedUnit.rent_amount : 0),
      property_id: form.property_id || (selectedUnit ? selectedUnit.property_id : ""),
    };
    if (editing) {
      await mysql.entities.Tenant.update(editing.id, payload);
    } else {
      await mysql.entities.Tenant.create(payload);
      if (selectedUnit && selectedUnit.status !== "Occupied") {
        await mysql.entities.Unit.update(selectedUnit.id, { status: "Occupied" });
      }
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(tenant) {
    if (!confirm(`Remove tenant "${tenant.full_name}"?`)) return;
    await mysql.entities.Tenant.delete(tenant.id);
    if (tenant.unit_id) {
      await mysql.entities.Unit.update(tenant.unit_id, { status: "Vacant" });
    }
    loadData();
  }

  function unitLabel(unitId) {
    const u = units.find((x) => x.id === unitId);
    return u ? `Unit ${u.unit_number} (${u.type})` : "—";
  }

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase();
    const unit = units.find((u) => u.id === t.unit_id);
    return (
      t.full_name?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.status?.toLowerCase().includes(q) ||
      unit?.unit_number?.toLowerCase().includes(q)
    );
  });

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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">Manage tenant records and lease information</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search name, phone, unit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add Tenant
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No tenants found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Name</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Phone</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Unit</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Rent</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Balance</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Lease</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link to={`/tenants/${t.id}`} className="hover:underline flex items-center gap-1">
                        {t.full_name}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{unitLabel(t.unit_id)}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatTsh(t.monthly_rent)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={t.balance > 0 ? "font-medium text-rose-600" : "text-slate-400"}>{formatTsh(t.balance)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(t.status)}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(t.lease_start)} → {formatDate(t.lease_end)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100">
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg hover:bg-rose-50">
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
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-lg text-slate-900">{editing ? "Edit Tenant" : "New Tenant"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="mt-1" />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
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
                  <select value={form.unit_id} onChange={(e) => {
                    const unit = units.find((u) => u.id === e.target.value);
                    setForm({ ...form, unit_id: e.target.value, monthly_rent: unit?.rent_amount || form.monthly_rent });
                  }} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select unit</option>
                    {units.filter((u) => !form.property_id || u.property_id === form.property_id).map((u) => (
                      <option key={u.id} value={u.id}>Unit {u.unit_number} — {u.type}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lease Start</Label>
                  <Input type="date" value={form.lease_start} onChange={(e) => setForm({ ...form, lease_start: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Lease End</Label>
                  <Input type="date" value={form.lease_end} onChange={(e) => setForm({ ...form, lease_end: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Monthly Rent</Label>
                  <Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: parseInt(e.target.value) || 0 })} className="mt-1" />
                </div>
                <div>
                  <Label>Balance</Label>
                  <Input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: parseInt(e.target.value) || 0 })} className="mt-1" />
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Notice</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Identification</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>NIDA Number</Label>
                    <Input value={form.nida_number} onChange={(e) => setForm({ ...form, nida_number: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Passport No.</Label>
                    <Input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>TIN Number</Label>
                    <Input value={form.tin_number} onChange={(e) => setForm({ ...form, tin_number: e.target.value })} className="mt-1" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Employment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Employer / Company</Label>
                    <Input value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Employer Phone</Label>
                    <Input value={form.employer_phone} onChange={(e) => setForm({ ...form, employer_phone: e.target.value })} className="mt-1" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Next of Kin</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={form.next_of_kin_name} onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.next_of_kin_phone} onChange={(e) => setForm({ ...form, next_of_kin_phone: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Relationship</Label>
                    <Input value={form.next_of_kin_relation} onChange={(e) => setForm({ ...form, next_of_kin_relation: e.target.value })} className="mt-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">{editing ? "Save Changes" : "Add Tenant"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}