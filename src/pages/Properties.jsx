import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Plus, Building2, Pencil, Trash2, X, MapPin, LocateFixed, Loader2, Search } from "lucide-react";
import { formatTsh } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PropertyDetailModal from "@/components/PropertyDetailModal";

const UNIT_TYPES = ["Studio", "1BR", "2BR", "3BR", "4BR", "Shop", "Office", "Warehouse"];
const emptyForm = { name: "", address: "", type: "Residential", description: "" };
const emptyUnit = { unit_number: "", type: "1BR", rent_amount: "" };

function normalizeUnitCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export default function Properties() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formUnits, setFormUnits] = useState([]);
  const [search, setSearch] = useState("");
  const [addressMode, setAddressMode] = useState("manual");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [props, allUnits, allTenants] = await Promise.all([
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.Tenant.list("-created_date", 500),
      ]);
      setProperties(props);
      setUnits(allUnits);
      setTenants(allTenants);
    } finally {
      setLoading(false);
    }
  }

  function resetAddressMode() {
    setAddressMode("manual");
    setLocationError("");
    setLocating(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormUnits([]);
    resetAddressMode();
    setShowForm(true);
  }

  function openEdit(prop) {
    setEditing(prop);
    setForm({
      name: prop.name,
      address: prop.address,
      type: prop.type,
      description: prop.description || "",
    });
    const propUnits = units.filter((u) => u.property_id === prop.id);
    setFormUnits(propUnits.map((u) => ({ unit_number: u.unit_number, type: u.type || "1BR", rent_amount: u.rent_amount || "" })));
    resetAddressMode();
    setShowForm(true);
  }

  function detectAddress() {
    setAddressMode("auto");
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Location detection is not supported by this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            format: "jsonv2",
            lat: String(coords.latitude),
            lon: String(coords.longitude),
            zoom: "18",
            addressdetails: "1",
          });
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
          if (!response.ok) throw new Error("Address lookup failed");
          const result = await response.json();
          const address = result.display_name?.trim();
          if (!address) throw new Error("No address found for this location");
          setForm((current) => ({ ...current, address }));
        } catch {
          setLocationError("Location was found, but its address could not be loaded. Use Manual instead.");
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocationError(error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow it in the browser or use Manual."
          : "Current location could not be detected. Try again or use Manual.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function addUnit() {
    setFormUnits([...formUnits, { ...emptyUnit }]);
  }

  function removeUnit(index) {
    setFormUnits(formUnits.filter((_, i) => i !== index));
  }

  function updateUnit(index, field, value) {
    const updated = [...formUnits];
    updated[index] = { ...updated[index], [field]: value };
    setFormUnits(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, unit_count: formUnits.length };
      let propId;
      if (editing) {
        await mysql.entities.Property.update(editing.id, payload);
        propId = editing.id;
      } else {
        const created = await mysql.entities.Property.create(payload);
        propId = created.id;
      }

      if (formUnits.length > 0) {
        const existingUnits = editing ? units.filter((u) => u.property_id === propId) : [];
        for (let i = 0; i < formUnits.length; i++) {
          const u = formUnits[i];
          const unitPayload = {
            property_id: propId,
            unit_number: u.unit_number,
            type: u.type,
            rent_amount: parseInt(u.rent_amount) || 0,
            status: "Vacant",
          };
          if (editing && existingUnits[i]) {
            await mysql.entities.Unit.update(existingUnits[i].id, unitPayload);
          } else {
            await mysql.entities.Unit.create(unitPayload);
          }
        }
      }

      setShowForm(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(prop) {
    if (!confirm(`Delete property "${prop.name}"?`)) return;
    await mysql.entities.Property.delete(prop.id);
    loadData();
  }

  const filtered = properties.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your property portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add Property
          </Button>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No properties yet. Add your first property to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No properties match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((prop) => {
            const propUnits = units.filter((unit) => unit.property_id === prop.id);
            const occupied = propUnits.filter((unit) => unit.status === "Occupied").length;
            const totalUnits = Math.max(normalizeUnitCount(prop.unit_count), propUnits.length);
            const vacant = Math.max(0, totalUnits - occupied);
            const totalRent = propUnits.reduce((sum, unit) => sum + (unit.rent_amount || 0), 0);
            return (
              <div key={prop.id} onClick={() => setSelected(prop)} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer active:scale-[0.98]">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(prop); }} className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit property">
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(prop); }} className="p-1.5 rounded-lg hover:bg-rose-50" title="Delete property">
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>
                <h3 className="font-heading font-semibold text-slate-900 mt-3">{prop.name}</h3>
                <p className="text-sm text-slate-500">{prop.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{prop.type}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                  <div><p className="text-sm font-bold text-slate-900">{totalUnits}</p><p className="text-xs text-slate-400">Units</p></div>
                  <div><p className="text-sm font-bold text-emerald-600">{occupied}</p><p className="text-xs text-slate-400">Occupied</p></div>
                  <div><p className="text-sm font-bold text-rose-600">{vacant}</p><p className="text-xs text-slate-400">Vacant</p></div>
                  <div><p className="text-sm font-bold text-slate-900">{formatTsh(totalRent).replace("Tsh ", "").replace(/000$/, "K")}</p><p className="text-xs text-slate-400">Rent/mo</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-lg text-slate-900">{editing ? "Edit Property" : "New Property"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Close">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Property Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label>Address *</Label>
                <div className="mt-1 grid grid-cols-2 rounded-md border border-slate-200 p-1">
                  <button type="button" onClick={() => { setAddressMode("manual"); setLocationError(""); }} className={`flex h-8 items-center justify-center gap-2 rounded text-sm font-medium ${addressMode === "manual" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                    <MapPin className="h-4 w-4" /> Manual
                  </button>
                  <button type="button" onClick={detectAddress} className={`flex h-8 items-center justify-center gap-2 rounded text-sm font-medium ${addressMode === "auto" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Auto Detect
                  </button>
                </div>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} readOnly={addressMode === "auto" && locating} required className="mt-2" placeholder={addressMode === "auto" ? "Detected address will appear here" : "Enter property address"} />
                {addressMode === "auto" && !locating && (
                  <Button type="button" variant="outline" size="sm" onClick={detectAddress} className="mt-2 w-full">
                    <LocateFixed className="h-4 w-4" /> Detect Current Location
                  </Button>
                )}
                {locationError && <p className="mt-2 text-xs text-rose-600">{locationError}</p>}
              </div>
              <div>
                <Label>Type</Label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option>Residential</option><option>Commercial</option><option>Mixed</option>
                </select>
              </div>
              <div>
                <Label>Description</Label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>

              {/* Units Section */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Units ({formUnits.length})</Label>
                  <button type="button" onClick={addUnit} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                    <Plus className="w-3 h-3" /> Add Unit
                  </button>
                </div>
                {formUnits.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
                    No units added yet. Click "Add Unit" to create one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formUnits.map((u, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                        <input
                          value={u.unit_number}
                          onChange={(e) => updateUnit(i, "unit_number", e.target.value)}
                          placeholder="Unit #"
                          required
                          className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white"
                        />
                        <select
                          value={u.type}
                          onChange={(e) => updateUnit(i, "type", e.target.value)}
                          className="w-20 px-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white"
                        >
                          {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="relative flex-1 min-w-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Tsh</span>
                          <input
                            type="number"
                            value={u.rent_amount}
                            onChange={(e) => updateUnit(i, "rent_amount", e.target.value)}
                            placeholder="Rent"
                            className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white"
                          />
                        </div>
                        <button type="button" onClick={() => removeUnit(i)} className="p-1.5 rounded-md hover:bg-rose-50 flex-shrink-0" title="Remove unit">
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Property"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && <PropertyDetailModal property={selected} units={units} tenants={tenants} onClose={() => setSelected(null)} onRefresh={loadData} />}
    </div>
  );
}
