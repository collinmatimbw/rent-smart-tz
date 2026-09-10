import React, { useState } from "react";
import { Link } from "react-router-dom";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate, statusColor } from "@/lib/format";
import { generateContractPdf } from "@/lib/contractPdf";
import {
  Phone, Search, Wallet, Download, LogOut, Building2,
  User, CheckCircle2, AlertCircle, ArrowLeft, Calendar, Loader2, Bell
} from "lucide-react";

function normalizePhone(input) {
  let p = input.replace(/[\s\-()]/g, "");
  if (p.startsWith("+255")) p = "0" + p.slice(4);
  else if (p.startsWith("255") && p.length === 12) p = "0" + p.slice(3);
  else if (!p.startsWith("0") && p.length === 9) p = "0" + p;
  return p;
}

export default function Portal() {
  const [phone, setPhone] = useState("");
  const [tenant, setTenant] = useState(null);
  const [payments, setPayments] = useState([]);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reminders, setReminders] = useState([]);

  async function handleLookup(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizePhone(phone);
      const allTenants = await mysql.entities.Tenant.list("-created_date", 500);
      const matches = allTenants.filter(
        (t) => normalizePhone(t.phone || "") === normalized
      );
      if (matches.length === 0) {
        throw new Error("No tenant found with this phone number. Please check and try again.");
      }
      const t = matches[0];
      setTenant(t);
      const [pays, prop, un, rems] = await Promise.allSettled([
        mysql.entities.Payment.filter({ tenant_id: t.id }, "-payment_date", 100),
        t.property_id ? mysql.entities.Property.get(t.property_id) : Promise.resolve(null),
        t.unit_id ? mysql.entities.Unit.get(t.unit_id) : Promise.resolve(null),
        mysql.entities.RentReminder.filter({ tenant_id: t.id }, "-reminder_date", 50),
      ]);
      setPayments(pays.status === "fulfilled" ? pays.value : []);
      setProperty(prop.status === "fulfilled" ? prop.value : null);
      setUnit(un.status === "fulfilled" ? un.value : null);
      setReminders(rems.status === "fulfilled" ? rems.value : []);
    } catch (e) {
      setError(e.message || "Failed to retrieve information. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setTenant(null);
    setPhone("");
    setPayments([]);
    setProperty(null);
    setUnit(null);
    setReminders([]);
    setError(null);
  }

  // Phone lookup screen
  if (!tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Tenant Portal</h1>
            <p className="text-slate-300 text-sm mt-2">Enter your phone number to view your information</p>
          </div>

          <form onSubmit={handleLookup} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Phone Number</label>
              <div className="relative mt-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent text-lg"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-lg">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><Search className="w-5 h-5" /> Enter</>
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to system
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Tenant dashboard
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-300">Welcome</p>
              <h1 className="text-lg font-bold">{tenant.full_name}</h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Balance card */}
        <div className={`rounded-2xl p-6 ${tenant.balance > 0 ? "bg-gradient-to-br from-rose-500 to-rose-600" : "bg-gradient-to-br from-emerald-500 to-emerald-600"} text-white shadow-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Rent Balance</p>
              <p className="text-3xl font-bold mt-1">{formatTsh(tenant.balance)}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              {tenant.balance > 0 ? <AlertCircle className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm text-white/90">
            <span>Monthly Rent: <b>{formatTsh(tenant.monthly_rent)}</b></span>
            <span>•</span>
            <span>Status: <b>{tenant.status}</b></span>
          </div>
        </div>

        {/* Rent reminders */}
        {reminders.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-amber-700 mb-3">
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">Rent Reminders</span>
            </div>
            <div className="space-y-2">
              {reminders.map((r) => (
                <div key={r.id} className="bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{formatTsh(r.amount_due)}</span>
                    <span className="text-xs text-slate-400">{formatDate(r.reminder_date)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{r.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Property</span>
            </div>
            <p className="font-semibold text-slate-900">{property?.name || "—"}</p>
            <p className="text-sm text-slate-500">{property?.address || "—"}</p>
            <div className="mt-2 text-sm text-slate-600">
              Unit: <b>{unit?.unit_number || "—"}</b> ({unit?.type || "—"})
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Lease</span>
            </div>
            <p className="text-sm text-slate-600">
              From: <b className="text-slate-900">{formatDate(tenant.lease_start)}</b>
            </p>
            <p className="text-sm text-slate-600">
              Until: <b className="text-slate-900">{formatDate(tenant.lease_end)}</b>
            </p>
          </div>
        </div>

        {/* Download contract */}
        <button
          onClick={() => generateContractPdf(tenant, property, unit)}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-sm"
        >
          <Download className="w-5 h-5" /> Download Tenancy Agreement
        </button>

        {/* Payment history */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Payment History</h3>
            </div>
            <span className="text-sm text-slate-500">Total: <b className="text-slate-900">{formatTsh(totalPaid)}</b></span>
          </div>
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No payments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-medium text-slate-600 px-4 py-3">Date</th>
                    <th className="text-left font-medium text-slate-600 px-4 py-3">Rent Period</th>
                    <th className="text-left font-medium text-slate-600 px-4 py-3">Method</th>
                    <th className="text-right font-medium text-slate-600 px-4 py-3">Amount</th>
                    <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{formatDate(p.payment_date)}</td>
                      <td className="px-4 py-3 text-slate-600">{p.period || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.method}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatTsh(p.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}