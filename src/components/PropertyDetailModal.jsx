import React, { useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { X, Building2, Home, Users, Wallet, AlertTriangle, Pencil, Trash2, Plus } from "lucide-react";
import { formatTsh, statusColor } from "@/lib/format";

const UNIT_TYPES = ["Studio", "1BR", "2BR", "3BR", "4BR", "Shop", "Office", "Warehouse"];

export default function PropertyDetailModal({ property, units: allUnits, tenants, onClose, onRefresh }) {
  const [units, setUnits] = useState(allUnits);
  const [editingUnit, setEditingUnit] = useState(null);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitForm, setUnitForm] = useState({ unit_number: "", type: "1BR", rent_amount: 0, status: "Vacant" });

  if (!property) return null;

  const propUnits = units.filter((u) => u.property_id === property.id);
  const propTenants = tenants.filter((t) => t.property_id === property.id);
  const occupied = propUnits.filter((u) => u.status === "Occupied").length;
  const totalUnits = Math.max(0, Math.trunc(Number(property.unit_count) || 0), propUnits.length);
  const vacant = Math.max(0, totalUnits - occupied);
  const totalRent = propUnits.reduce((s, u) => s + (u.rent_amount || 0), 0);
  const outstanding = propTenants.reduce((s, t) => s + (t.balance || 0), 0);
  const unitLabel = (id) => propUnits.find((u) => u.id === id)?.unit_number || "—";

  const stats = [
    { label: "Units", value: totalUnits, icon: Home, color: "text-slate-600", bg: "bg-slate-50" },
    { label: "Occupied", value: occupied, icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Vacant", value: vacant, icon: Users, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Rent/mo", value: formatTsh(totalRent), icon: Wallet, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  function openCreateUnit() {
    setEditingUnit(null);
    setUnitForm({ unit_number: "", type: "1BR", rent_amount: 0, status: "Vacant" });
    setShowUnitForm(true);
  }

  function openEditUnit(u) {
    setEditingUnit(u);
    setUnitForm({ unit_number: u.unit_number || "", type: u.type || "1BR", rent_amount: u.rent_amount || 0, status: u.status || "Vacant" });
    setShowUnitForm(true);
  }

  async function handleUnitSubmit(e) {
    e.preventDefault();
    const payload = {
      property_id: property.id,
      unit_number: unitForm.unit_number,
      type: unitForm.type,
      rent_amount: parseInt(unitForm.rent_amount) || 0,
      status: unitForm.status,
    };
    if (editingUnit) {
      await mysql.entities.Unit.update(editingUnit.id, payload);
    } else {
      await mysql.entities.Unit.create(payload);
    }
    const updated = await mysql.entities.Unit.list("-created_date", 500);
    setUnits(updated);
    setShowUnitForm(false);
    if (onRefresh) onRefresh();
  }

  async function handleDeleteUnit(u) {
    const isOccupied = tenants.some((t) => t.unit_id === u.id);
    if (isOccupied) {
      alert("Cannot delete a unit that has an assigned tenant.");
      return;
    }
    if (!confirm(`Delete unit ${u.unit_number}?`)) return;
    await mysql.entities.Unit.delete(u.id);
    const updated = await mysql.entities.Unit.list("-created_date", 500);
    setUnits(updated);
    if (onRefresh) onRefresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading font-semibold text-lg text-slate-900 truncate">{property.name}</h2>
                <p className="text-sm text-slate-500 truncate">{property.address}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 flex-shrink-0">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{property.type}</span>
            {outstanding > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {formatTsh(outstanding)} outstanding
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 p-5 border-b border-slate-100">
          {stats.map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
              <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
              <p className="text-sm font-bold text-slate-900 truncate">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Units + Tenants */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Units */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Units ({totalUnits})</h3>
              <button onClick={openCreateUnit} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                <Plus className="w-3 h-3" /> Add Unit
              </button>
            </div>
            {propUnits.length === 0 ? (
              <p className="text-sm text-slate-400">No individual unit details registered yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium text-slate-600 px-3 py-2">Unit #</th>
                      <th className="text-left font-medium text-slate-600 px-3 py-2">Type</th>
                      <th className="text-right font-medium text-slate-600 px-3 py-2">Rent</th>
                      <th className="text-center font-medium text-slate-600 px-3 py-2">Status</th>
                      <th className="text-right font-medium text-slate-600 px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {propUnits.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{u.unit_number}</td>
                        <td className="px-3 py-2 text-slate-600">{u.type}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatTsh(u.rent_amount)}</td>
                        <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-1 rounded-full ${statusColor(u.status)}`}>{u.status}</span></td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditUnit(u)} className="p-1 rounded hover:bg-slate-100" title="Edit unit">
                              <Pencil className="w-3 h-3 text-slate-400" />
                            </button>
                            <button onClick={() => handleDeleteUnit(u)} className="p-1 rounded hover:bg-rose-50" title="Delete unit">
                              <Trash2 className="w-3 h-3 text-rose-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tenants */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Tenants ({propTenants.length})</h3>
            {propTenants.length === 0 ? (
              <p className="text-sm text-slate-400">No tenants registered</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium text-slate-600 px-3 py-2">Name</th>
                      <th className="text-left font-medium text-slate-600 px-3 py-2">Unit</th>
                      <th className="text-left font-medium text-slate-600 px-3 py-2">Phone</th>
                      <th className="text-right font-medium text-slate-600 px-3 py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {propTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{t.full_name}</td>
                        <td className="px-3 py-2 text-slate-600">{unitLabel(t.unit_id)}</td>
                        <td className="px-3 py-2 text-slate-600">{t.phone || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {(t.balance || 0) > 0 ? (
                            <span className="font-medium text-rose-600">{formatTsh(t.balance)}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Unit Form Modal */}
        {showUnitForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnitForm(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-lg text-slate-900">{editingUnit ? "Edit Unit" : "Add Unit"}</h3>
                <button onClick={() => setShowUnitForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleUnitSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Unit Number *</label>
                  <input value={unitForm.unit_number} onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })} required className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. A1, 101" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <select value={unitForm.type} onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Rent Amount (Tsh)</label>
                  <input type="number" value={unitForm.rent_amount} onChange={(e) => setUnitForm({ ...unitForm, rent_amount: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select value={unitForm.status} onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option>Vacant</option>
                    <option>Occupied</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                    {editingUnit ? "Save Changes" : "Add Unit"}
                  </button>
                  <button type="button" onClick={() => setShowUnitForm(false)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
