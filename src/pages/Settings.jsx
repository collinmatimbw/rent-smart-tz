import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { Settings as SettingsIcon, Save, Building, Percent, Landmark, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-900 min-h-[38px]">{value || "—"}</p>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [settingId, setSettingId] = useState(null);
  const [form, setForm] = useState({
    company_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    tin_number: "",
    logo_url: "",
    penalty_rate: 5,
    grace_period_days: 5,
    late_fee_policy: "Percentage",
    fixed_late_fee: 0,
    currency: "TSH",
    fiscal_year_start: "January",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    mpesa_paybill: "",
    airtel_money_number: "",
    tigopesa_number: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const settings = await mysql.entities.Setting.list("-created_date", 10);
      if (settings.length > 0) {
        const s = settings[0];
        setSettingId(s.id);
        setForm({
          company_name: s.company_name || "",
          contact_person: s.contact_person || "",
          phone: s.phone || "",
          email: s.email || "",
          address: s.address || "",
          tin_number: s.tin_number || "",
          logo_url: s.logo_url || "",
          penalty_rate: s.penalty_rate ?? 5,
          grace_period_days: s.grace_period_days ?? 5,
          late_fee_policy: s.late_fee_policy || "Percentage",
          fixed_late_fee: s.fixed_late_fee ?? 0,
          currency: s.currency || "TSH",
          fiscal_year_start: s.fiscal_year_start || "January",
          bank_name: s.bank_name || "",
          bank_account_name: s.bank_account_name || "",
          bank_account_number: s.bank_account_number || "",
          mpesa_paybill: s.mpesa_paybill || "",
          airtel_money_number: s.airtel_money_number || "",
          tigopesa_number: s.tigopesa_number || "",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (settingId) {
        await mysql.entities.Setting.update(settingId, form);
      } else {
        const created = await mysql.entities.Setting.create(form);
        setSettingId(created.id);
      }
      setEditing(false);
      toast({ title: "Settings saved successfully" });
    } catch (err) {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" /> Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure your organization profile and system preferences</p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing(true)} className="gap-2">
            <Pencil className="w-4 h-4" /> Edit Settings
          </Button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Profile */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building className="w-5 h-5 text-slate-400" />
            <h2 className="font-heading font-semibold text-slate-900">Company / Landlord Profile</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editing ? (
              <>
                <div>
                  <Label>Company / Landlord Name *</Label>
                  <Input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} required className="mt-1" placeholder="e.g. ABC Properties Ltd" />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input value={form.contact_person} onChange={(e) => update("contact_person", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-1" placeholder="+255..." />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>TIN Number</Label>
                  <Input value={form.tin_number} onChange={(e) => update("tin_number", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} className="mt-1" placeholder="https://..." />
                </div>
              </>
            ) : (
              <>
                <ReadOnlyField label="Company / Landlord Name" value={form.company_name} />
                <ReadOnlyField label="Contact Person" value={form.contact_person} />
                <ReadOnlyField label="Phone" value={form.phone} />
                <ReadOnlyField label="Email" value={form.email} />
                <div className="md:col-span-2">
                  <ReadOnlyField label="Address" value={form.address} />
                </div>
                <ReadOnlyField label="TIN Number" value={form.tin_number} />
                <ReadOnlyField label="Logo URL" value={form.logo_url} />
              </>
            )}
          </div>
        </section>

        {/* Penalty & Late Fee Configuration */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-5 h-5 text-slate-400" />
            <h2 className="font-heading font-semibold text-slate-900">Penalty & Late Fee Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editing ? (
              <>
                <div>
                  <Label>Penalty Rate (%)</Label>
                  <Input type="number" step="0.5" value={form.penalty_rate} onChange={(e) => update("penalty_rate", parseFloat(e.target.value) || 0)} className="mt-1" />
                  <p className="text-xs text-slate-400 mt-1">Applied to overdue rent each month</p>
                </div>
                <div>
                  <Label>Rent Grace Period (Days)</Label>
                  <Input type="number" value={form.grace_period_days} onChange={(e) => update("grace_period_days", parseInt(e.target.value) || 0)} className="mt-1" />
                  <p className="text-xs text-slate-400 mt-1">Days after due date before penalty applies</p>
                </div>
                <div>
                  <Label>Late Fee Policy</Label>
                  <select value={form.late_fee_policy} onChange={(e) => update("late_fee_policy", e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Percentage</option>
                    <option>Fixed Amount</option>
                    <option>None</option>
                  </select>
                </div>
                {form.late_fee_policy === "Fixed Amount" && (
                  <div>
                    <Label>Fixed Late Fee (Tsh)</Label>
                    <Input type="number" value={form.fixed_late_fee} onChange={(e) => update("fixed_late_fee", parseInt(e.target.value) || 0)} className="mt-1" />
                  </div>
                )}
              </>
            ) : (
              <>
                <ReadOnlyField label="Penalty Rate (%)" value={`${form.penalty_rate}%`} />
                <ReadOnlyField label="Rent Grace Period (Days)" value={form.grace_period_days} />
                <ReadOnlyField label="Late Fee Policy" value={form.late_fee_policy} />
                {form.late_fee_policy === "Fixed Amount" && (
                  <ReadOnlyField label="Fixed Late Fee (Tsh)" value={form.fixed_late_fee} />
                )}
              </>
            )}
          </div>
        </section>

        {/* Payment Accounts */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-slate-400" />
            <h2 className="font-heading font-semibold text-slate-900">Payment Accounts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editing ? (
              <>
                <div>
                  <Label>Bank Name</Label>
                  <Input value={form.bank_name} onChange={(e) => update("bank_name", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Bank Account Name</Label>
                  <Input value={form.bank_account_name} onChange={(e) => update("bank_account_name", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Bank Account Number</Label>
                  <Input value={form.bank_account_number} onChange={(e) => update("bank_account_number", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>M-Pesa Paybill / Business Number</Label>
                  <Input value={form.mpesa_paybill} onChange={(e) => update("mpesa_paybill", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Airtel Money Number</Label>
                  <Input value={form.airtel_money_number} onChange={(e) => update("airtel_money_number", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Tigo Pesa Number</Label>
                  <Input value={form.tigopesa_number} onChange={(e) => update("tigopesa_number", e.target.value)} className="mt-1" />
                </div>
              </>
            ) : (
              <>
                <ReadOnlyField label="Bank Name" value={form.bank_name} />
                <ReadOnlyField label="Bank Account Name" value={form.bank_account_name} />
                <ReadOnlyField label="Bank Account Number" value={form.bank_account_number} />
                <ReadOnlyField label="M-Pesa Paybill / Business Number" value={form.mpesa_paybill} />
                <ReadOnlyField label="Airtel Money Number" value={form.airtel_money_number} />
                <ReadOnlyField label="Tigo Pesa Number" value={form.tigopesa_number} />
              </>
            )}
          </div>
        </section>

        {/* System Preferences */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-slate-400" />
            <h2 className="font-heading font-semibold text-slate-900">System Preferences</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editing ? (
              <>
                <div>
                  <Label>Currency</Label>
                  <Input value={form.currency} onChange={(e) => update("currency", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Fiscal Year Start</Label>
                  <select value={form.fiscal_year_start} onChange={(e) => update("fiscal_year_start", e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>January</option>
                    <option>April</option>
                    <option>July</option>
                    <option>October</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <ReadOnlyField label="Currency" value={form.currency} />
                <ReadOnlyField label="Fiscal Year Start" value={form.fiscal_year_start} />
              </>
            )}
          </div>
        </section>

        {editing && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-2 px-8">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
