import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { mysql } from "@/api/mysqlClient";
import { formatTsh } from "@/lib/format";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertCircle, ArrowRight, Database, Trash2, Download } from "lucide-react";

const MONTH_KEYS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const MONTH_PERIODS = MONTH_KEYS.map((_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
const PROPERTY_SHEETS = ["MIVUMONI", "GOBA", "CHANIKA", "KILUVYA"];

function toTitle(s) {
  return s.split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [replace, setReplace] = useState(true);
  const [progress, setProgress] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const inputRef = useRef(null);

  async function clearAllData() {
    if (!confirm("This will delete ALL data (Properties, Units, Tenants, Payments, Expenses, Maintenance, Staff, Utilities, Inventory, Penalties, Leads & Reminders). Are you sure?")) return;
    setClearing(true);
    setError(null);
    try {
      await Promise.all([
        mysql.entities.Payment.deleteMany({}),
        mysql.entities.Tenant.deleteMany({}),
        mysql.entities.Unit.deleteMany({}),
        mysql.entities.Property.deleteMany({}),
        mysql.entities.Expense.deleteMany({}),
        mysql.entities.MaintenanceRequest.deleteMany({}),
        mysql.entities.Staff.deleteMany({}),
        mysql.entities.Utility.deleteMany({}),
        mysql.entities.Inventory.deleteMany({}),
        mysql.entities.Penalty.deleteMany({}),
        mysql.entities.Lead.deleteMany({}),
        mysql.entities.RentReminder.deleteMany({}),
      ]);
      setClearDone(true);
      setTimeout(() => setClearDone(false), 5000);
    } catch (e) {
      setError(e.message || "Failed to clear data. Please try again.");
    } finally {
      setClearing(false);
    }
  }

  async function handleFile(f) {
    setFile(f);
    setParsing(true);
    setError(null);
    setParsed(null);
    setResults(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // Parse per-property sheets for annual rent + outstanding debt per unit
      const unitRents = {};
      const unitBalances = {};
      PROPERTY_SHEETS.forEach((sn) => {
        if (!wb.SheetNames.includes(sn)) return;
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
        unitRents[sn] = {};
        unitBalances[sn] = {};
        // Search first 5 rows for "Juma deni" header (may not be in row 0)
        let debtCol = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          for (let c = 0; c < (rows[i] || []).length; c++) {
            const h = String(rows[i][c] || "").toLowerCase();
            if (h.includes("juma deni") || h.includes("jumadeni")) { debtCol = c; break; }
          }
          if (debtCol >= 0) break;
        }
        // Data starts after title/empty/header rows (row 3+)
        for (let i = 3; i < rows.length; i++) {
          const r = rows[i] || [];
          const unit = r[1] ? String(r[1]).trim().toUpperCase() : null;
          const annualRent = Number(r[2]) || 0;
          if (unit && annualRent > 0) unitRents[sn][unit] = annualRent;
          if (unit && debtCol >= 0) {
            const debt = Number(r[debtCol]) || 0;
            if (debt > 0) unitBalances[sn][unit] = debt;
          }
        }
      });

      // Parse DIRECT & INDIRECT COST sheet for expenses
      const expenses = [];
      const costSheet = wb.Sheets["DIRECT & INDIRECT COST"];
      if (costSheet) {
        const costRows = XLSX.utils.sheet_to_json(costSheet, { header: 1, defval: null });
        const expenseCats = [
          { col: 2, category: "Security", label: "Ulinzi" },
          { col: 3, category: "Cleaning", label: "Usafi" },
          { col: 4, category: "Salaries", label: "Mishahara" },
          { col: 5, category: "Utilities", label: "Umeme" },
          { col: 6, category: "Maintenance", label: "Ukarabati" },
        ];
        for (let i = 1; i < costRows.length; i++) {
          const r = costRows[i];
          const month = r[1] ? String(r[1]).trim().toUpperCase() : "";
          if (!month || !MONTH_KEYS.includes(month)) continue;
          const mIdx = MONTH_KEYS.indexOf(month);
          const period = MONTH_PERIODS[mIdx];
          const date = `${period}-15`;
          expenseCats.forEach((cat) => {
            const amt = Number(r[cat.col]) || 0;
            if (amt > 0) {
              expenses.push({
                description: `${cat.label} - ${month}`,
                amount: amt,
                date,
                category: cat.category,
                payment_method: "Cash",
              });
            }
          });
        }
      }

      // Parse General Ledger with NAMES
      const glSheet = wb.Sheets["General Ledger with NAMES"];
      if (!glSheet) throw new Error("Sheet 'General Ledger with NAMES' not found in file");
      const glRows = XLSX.utils.sheet_to_json(glSheet, { header: 1, defval: null });

      const tenants = [];
      let currentSection = "";

      for (let i = 0; i < glRows.length; i++) {
        const r = glRows[i] || [];
        const c0 = r[0] ? String(r[0]).trim() : "";
        if (c0.includes("ORODHA YA WAPANGAJI")) {
          currentSection = c0.replace(/ORODHA YA WAPANGAJI/i, "").trim().toUpperCase();
          continue;
        }
        const unit = c0;
        const name = r[1] ? String(r[1]).trim() : "";
        if (!unit || !name || unit === "Tenant at Property No." || name === "Name") continue;
        if (!/^[A-Z]/i.test(unit)) continue;

        const prop = (r[2] ? String(r[2]).trim() : "") || currentSection;
        const propName = prop.toUpperCase();
        const mobile = r[3] ? String(r[3]).trim() : "";
        const leaseStart = parseDate(r[4]);
        const leaseEnd = parseDate(r[5]);

        const payments = [];
        for (let m = 0; m < 12; m++) {
          const amt = Number(r[6 + m]) || 0;
          if (amt > 0) payments.push({ period: MONTH_PERIODS[m], amount: amt, date: `${MONTH_PERIODS[m]}-15` });
        }

        const annualRent = (unitRents[propName] && unitRents[propName][unit.toUpperCase()]) || 0;
        const monthlyRent = annualRent > 0 ? Math.round(annualRent / 12) : (payments[0]?.amount || 0);
        const balance = (unitBalances[propName] && unitBalances[propName][unit.toUpperCase()]) || 0;

        tenants.push({ unit, name, propName, mobile, leaseStart, leaseEnd, monthlyRent, balance, payments });
      }

      if (tenants.length === 0) throw new Error("No tenant data found in General Ledger sheet");
      setParsed({ tenants, unitRents, unitBalances, expenses });
    } catch (e) {
      setError(e.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function doImport() {
    setImporting(true);
    setError(null);
    try {
      const { tenants, expenses } = parsed;

      if (replace) {
        setProgress("Clearing existing data...");
        await Promise.all([
          mysql.entities.Payment.deleteMany({}),
          mysql.entities.Tenant.deleteMany({}),
          mysql.entities.Unit.deleteMany({}),
          mysql.entities.Property.deleteMany({}),
          mysql.entities.Expense.deleteMany({}),
        ]);
      }

      const propNames = [...new Set(tenants.map((t) => t.propName).filter(Boolean))];
      const propMap = {};

      if (!replace) {
        const existing = await mysql.entities.Property.list("-created_date", 500);
        existing.forEach((p) => { propMap[p.name.toUpperCase()] = p; });
      }

      for (const name of propNames) {
        if (propMap[name]) continue;
        const p = await mysql.entities.Property.create({ name: toTitle(name), address: toTitle(name), type: "Residential" });
        propMap[name] = p;
      }
      setProgress(`Created ${propNames.length} properties. Importing tenants...`);

      const allPayments = [];
      let uCount = 0, tCount = 0;

      for (const t of tenants) {
        const prop = propMap[t.propName];
        if (!prop) continue;

        const unit = await mysql.entities.Unit.create({
          property_id: prop.id,
          unit_number: t.unit,
          rent_amount: t.monthlyRent,
          status: "Occupied",
          type: "1BR",
        });
        uCount++;

        const tenant = await mysql.entities.Tenant.create({
          full_name: t.name,
          phone: t.mobile,
          unit_id: unit.id,
          property_id: prop.id,
          lease_start: t.leaseStart,
          lease_end: t.leaseEnd,
          monthly_rent: t.monthlyRent,
          balance: t.balance,
          status: "Active",
        });
        tCount++;

        for (const p of t.payments) {
          allPayments.push({
            tenant_id: tenant.id,
            unit_id: unit.id,
            amount: p.amount,
            payment_date: p.date,
            method: "M-Pesa",
            period: p.period,
            status: "Completed",
          });
        }
        if (tCount % 5 === 0) setProgress(`Imported ${tCount}/${tenants.length} tenants...`);
      }

      setProgress("Creating payment records...");
      let pCount = 0;
      for (let i = 0; i < allPayments.length; i += 500) {
        const batch = allPayments.slice(i, i + 500);
        await mysql.entities.Payment.bulkCreate(batch);
        pCount += batch.length;
      }

      // Import expenses
      let eCount = 0;
      if (expenses && expenses.length > 0) {
        setProgress(`Importing ${expenses.length} expense records...`);
        for (let i = 0; i < expenses.length; i += 500) {
          const batch = expenses.slice(i, i + 500);
          await mysql.entities.Expense.bulkCreate(batch);
          eCount += batch.length;
        }
      }

      const totalBalance = tenants.reduce((s, t) => s + (t.balance || 0), 0);
      setResults({ properties: propNames.length, units: uCount, tenants: tCount, payments: pCount, expenses: eCount, totalBalance });
      setParsed(null);
      setFile(null);
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
      setProgress("");
    }
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();

    // General Ledger sheet
    const glHeader = [
      "Unit", "Name", "Property", "Phone", "Lease Start", "Lease End",
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const glSample = [
      ["A1", "John Doe", "MIVUMONI", "0712345678", "2025-01-01", "2026-12-31", 120000, 120000, 0, 120000, 0, 0, 0, 0, 0, 0, 0, 0],
      ["B2", "Jane Smith", "GOBA", "0722334455", "2025-03-01", "2026-02-28", 0, 0, 150000, 150000, 150000, 0, 0, 0, 0, 0, 0, 0],
    ];
    const glWs = XLSX.utils.aoa_to_sheet([["ORODHA YA WAPANGAJI - MIVUMONI"], glHeader, ...glSample]);
    XLSX.utils.book_append_sheet(wb, glWs, "General Ledger with NAMES");

    // Per-property sheets (unit-level annual rent + debt)
    ["MIVUMONI", "GOBA", "CHANIKA", "KILUVYA"].forEach((sn) => {
      const ws = XLSX.utils.aoa_to_sheet([
        [sn, "Unit No.", "Annual Rent (Tsh)", "Juma Deni"],
        ["1", "A1", 1440000, 0],
        ["2", "B2", 1800000, 60000],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, sn);
    });

    // Direct & Indirect Cost sheet
    const costHeader = ["S/N", "Month", "Ulinzi (Security)", "Usafi (Cleaning)", "Mishahara (Salaries)", "Umeme (Utilities)", "Ukarabati (Maintenance)"];
    const costSample = [
      [1, "JANUARY", 50000, 30000, 300000, 45000, 20000],
      [2, "FEBRUARY", 50000, 30000, 300000, 42000, 0],
    ];
    const costWs = XLSX.utils.aoa_to_sheet([costHeader, ...costSample]);
    XLSX.utils.book_append_sheet(wb, costWs, "DIRECT & INDIRECT COST");

    XLSX.writeFile(wb, "RentSmart_Import_Template.xlsx");
  }

  const summaryStats = parsed
    ? {
        props: new Set(parsed.tenants.map((t) => t.propName)).size,
        tenants: parsed.tenants.length,
        payments: parsed.tenants.reduce((s, t) => s + t.payments.length, 0),
        expenses: parsed.expenses?.length || 0,
        rent: parsed.tenants.reduce((s, t) => s + t.monthlyRent, 0),
        balance: parsed.tenants.reduce((s, t) => s + (t.balance || 0), 0),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Import Data from Excel</h1>
        <p className="text-sm text-slate-500 mt-1">Upload your property ledger Excel file to auto-populate Properties, Units, Tenants & Payments</p>
      </div>

      {/* Upload zone */}
      {!parsed && !results && (
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                <p className="text-sm text-slate-500">Parsing Excel file...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">Click to change file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Click to upload Excel file</p>
                <p className="text-xs text-slate-400">Supports .xlsx files with General Ledger sheet</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
          </div>

          {clearDone && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700">All data has been cleared successfully. You can now upload a new Excel file.</p>
            </div>
          )}

          {/* Download template button */}
          <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-900">Download Excel Template</p>
              <p className="text-xs text-slate-500 mt-0.5">Pre-formatted template matching the import system structure</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex-shrink-0"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-rose-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* Clear all data button */}
          <div className="mt-4 flex items-center justify-between p-4 bg-rose-50 rounded-lg border border-rose-100">
            <div>
              <p className="text-sm font-medium text-rose-900">Clear All Data</p>
              <p className="text-xs text-rose-600 mt-0.5">Deletes Properties, Units, Tenants, Payments, Expenses, Maintenance, Staff, Utilities, Inventory, Penalties, Leads & Reminders</p>
            </div>
            <button
              onClick={clearAllData}
              disabled={clearing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 flex-shrink-0"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {clearing ? "Clearing..." : "Clear All"}
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {parsed && !importing && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-slate-900">Preview — {summaryStats.tenants} tenants found</h3>
            <div className="flex flex-wrap gap-6 mt-3 text-sm">
              <span className="text-slate-600">Properties: <b className="text-slate-900">{summaryStats.props}</b></span>
              <span className="text-slate-600">Payments: <b className="text-slate-900">{summaryStats.payments}</b></span>
              <span className="text-slate-600">Expenses: <b className="text-slate-900">{summaryStats.expenses}</b></span>
              <span className="text-slate-600">Total Monthly Rent: <b className="text-slate-900">{formatTsh(summaryStats.rent)}</b></span>
              <span className="text-slate-600">Outstanding Debt: <b className="text-rose-600">{formatTsh(summaryStats.balance)}</b></span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-2">Unit</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-2">Tenant Name</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-2">Property</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-2">Phone</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-2">Monthly Rent</th>
                  <th className="text-center font-medium text-slate-600 px-4 py-2">Payments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parsed.tenants.map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{t.unit}</td>
                    <td className="px-4 py-2 text-slate-700">{t.name}</td>
                    <td className="px-4 py-2 text-slate-600">{toTitle(t.propName)}</td>
                    <td className="px-4 py-2 text-slate-600">{t.mobile || "—"}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{formatTsh(t.monthlyRent)}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{t.payments.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-5 border-t border-slate-100 space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="rounded" />
              Replace all existing data (clears current Properties, Units, Tenants, Payments & Expenses before import)
            </label>
            <div className="flex gap-3">
              <button
                onClick={doImport}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                <Database className="w-4 h-4" /> Import {summaryStats.tenants} Tenants
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setParsed(null); setFile(null); }}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Importing progress */}
      {importing && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-600 mt-4">{progress || "Importing..."}</p>
        </div>
      )}

      {/* Results */}
      {results && !importing && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-heading font-semibold text-slate-900 mt-4">Import Complete!</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
            {[
               { label: "Properties", value: results.properties },
               { label: "Units", value: results.units },
               { label: "Tenants", value: results.tenants },
               { label: "Payments", value: results.payments },
               { label: "Expenses", value: results.expenses },
               { label: "Outstanding Debt", value: formatTsh(results.totalBalance) },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setResults(null)}
            className="mt-6 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}