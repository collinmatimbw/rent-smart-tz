import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Plus, Users, Pencil, Trash2, X, Search, Mail, Loader2, Check } from "lucide-react";
import { formatTsh, statusColor, formatDate } from "@/lib/format";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Staff() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [properties, setProperties] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [invitingId, setInvitingId] = useState(null);
  const [inviteDone, setInviteDone] = useState(null);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", role: "Caretaker", system_role: "user", property_id: "",
    salary: 0, status: "Active", start_date: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, p] = await Promise.all([
        mysql.entities.Staff.list("-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
      ]);
      setStaff(s);
      setProperties(p);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ full_name: "", phone: "", email: "", role: "Caretaker", system_role: "user", property_id: "", salary: 0, status: "Active", start_date: "" });
    setShowForm(true);
  }

  function openEdit(person) {
    setEditing(person);
    setForm({
      full_name: person.full_name, phone: person.phone, email: person.email || "",
      role: person.role, system_role: person.system_role || "user", property_id: person.property_id || "",
      salary: person.salary || 0, status: person.status, start_date: person.start_date || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, salary: parseInt(form.salary) || 0 };
    if (editing) {
      await mysql.entities.Staff.update(editing.id, payload);
    } else {
      await mysql.entities.Staff.create(payload);
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(person) {
    if (!confirm(`Remove staff member "${person.full_name}"?`)) return;
    await mysql.entities.Staff.delete(person.id);
    loadData();
  }

  async function handleInvite(person) {
    if (!person.email) {
      alert("Please add the staff member's email in their profile first.");
      return;
    }
    setInvitingId(person.id);
    try {
      await mysql.users.inviteUser(person.email, person.system_role || "user");
      setInviteDone(person.id);
      setTimeout(() => setInviteDone(null), 4000);
    } catch (e) {
      alert(e.message || "Failed to send invitation");
    } finally {
      setInvitingId(null);
    }
  }

  function propertyName(id) {
    const p = properties.find((x) => x.id === id);
    return p ? p.name : "—";
  }

  const filtered = staff.filter((s) =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search) || s.role?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSalary = staff.filter((s) => s.status === "Active").reduce((sum, s) => sum + (s.salary || 0), 0);

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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">Add staff members, assign system roles, and invite them to the system</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" />
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add Staff
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Staff</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-heading font-bold text-emerald-600 mt-2">{staff.filter((s) => s.status === "Active").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly Payroll</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-2">{formatTsh(totalSalary)}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No staff members found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Name</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Phone</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Role</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">System Role</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Property</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Salary</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Start Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s) => {
                  const sr = ROLES[s.system_role] || ROLES.user;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.phone}</td>
                      <td className="px-4 py-3 text-slate-600">{s.role}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sr.color}`}>{sr.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{propertyName(s.property_id)}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{formatTsh(s.salary)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(s.status)}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(s.start_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleInvite(s)} disabled={invitingId === s.id} title="Invite to system" className="p-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                            {inviteDone === s.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : invitingId === s.id ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <Mail className="w-3.5 h-3.5 text-blue-400" />}
                          </button>
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100">
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-rose-50">
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
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-lg text-slate-900">{editing ? "Edit Staff" : "New Staff Member"}</h2>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Role *</Label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Caretaker</option>
                    <option>Cleaner</option>
                    <option>Security</option>
                    <option>Technician</option>
                    <option>Manager</option>
                    <option>Accountant</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>System Access Role</Label>
                <select value={form.system_role} onChange={(e) => setForm({ ...form, system_role: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {Object.entries(ROLES).map(([key, r]) => (
                    <option key={key} value={key}>{r.label} — {r.description}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">This controls what the staff member can see in the system. After saving, use the email button to invite them to the system.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Assigned Property</Label>
                  <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select property</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Monthly Salary (Tsh)</Label>
                  <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: parseInt(e.target.value) || 0 })} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>On Leave</option>
                  </select>
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">{editing ? "Save Changes" : "Add Staff"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}