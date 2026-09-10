import React, { useEffect, useState } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate } from "@/lib/format";
import jsPDF from "jspdf";
import { FileText, Download, Building2, User, Search } from "lucide-react";

export default function Contracts() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tens, props, uns] = await Promise.all([
        mysql.entities.Tenant.filter({ status: "Active" }, "-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
      ]);
      setTenants(tens);
      setProperties(props);
      setUnits(uns);
      if (tens.length > 0) setSelectedId(tens[0].id);
    } finally {
      setLoading(false);
    }
  }

  const tenant = tenants.find((t) => t.id === selectedId);
  const property = properties.find((p) => p.id === tenant?.property_id);
  const unit = units.find((u) => u.id === tenant?.unit_id);

  const filteredTenants = tenants.filter((t) =>
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.toLowerCase().includes(search.toLowerCase())
  );

  function generatePDF() {
    if (!tenant) return;
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 20;

      function ensureSpace(needed = 10) {
        if (y + needed > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      }

      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("TENANCY AGREEMENT", pageWidth / 2, y, { align: "center" });
      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("United Republic of Tanzania", pageWidth / 2, y, { align: "center" });
      y += 12;

      doc.setDrawColor(200);
      doc.line(20, y, pageWidth - 20, y);
      y += 12;

      // Date
      doc.setFontSize(10);
      doc.text(`Date: ${formatDate(new Date().toISOString().slice(0, 10))}`, 20, y);
      y += 12;

      // Parties
      doc.setFont("helvetica", "bold");
      doc.text("THIS AGREEMENT is made between:", 20, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`THE LANDLORD (hereinafter "the Landlord") owner of the property known as`, 20, y);
      y += 6;
      doc.text(`${property?.name || "—"} situated at ${property?.address || "—"}.`, 20, y);
      y += 10;
      doc.text(`AND THE TENANT:`, 20, y);
      y += 8;
      doc.text(`Name: ${tenant.full_name}`, 20, y); y += 6;
      doc.text(`Phone: ${tenant.phone || "—"}`, 20, y); y += 6;
      if (tenant.email) { doc.text(`Email: ${tenant.email}`, 20, y); y += 6; }
      y += 6;

      // Terms
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.text("1. PROPERTY", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`The Landlord agrees to let to the Tenant the following premises:`, 20, y); y += 6;
      doc.text(`Property: ${property?.name || "—"}`, 25, y); y += 6;
      doc.text(`Address: ${property?.address || "—"}`, 25, y); y += 6;
      doc.text(`Unit Number: ${unit?.unit_number || "—"}`, 25, y); y += 6;
      doc.text(`Unit Type: ${unit?.type || "—"}`, 25, y); y += 6;
      doc.text(`Property Type: ${property?.type || "—"}`, 25, y); y += 12;

      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.text("2. TERM OF TENANCY", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`The tenancy shall commence on ${formatDate(tenant.lease_start)} and`, 20, y); y += 6;
      doc.text(`terminate on ${formatDate(tenant.lease_end)}, unless renewed.`, 20, y); y += 12;

      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.text("3. RENT", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`The Tenant shall pay a monthly rent of ${formatTsh(tenant.monthly_rent)}.`, 20, y); y += 6;
      doc.text(`Rent shall be payable on or before the 5th day of each calendar month.`, 20, y); y += 6;
      doc.text(`Late payment shall attract a penalty of 5% of the monthly rent.`, 20, y); y += 12;

      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.text("4. PAYMENT METHOD", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`Rent shall be paid via mobile money (M-Pesa, Tigo Pesa, Airtel Money),`, 20, y); y += 6;
      doc.text(`bank transfer, or cash to the Landlord or designated agent.`, 20, y); y += 12;

      ensureSpace(50);
      doc.setFont("helvetica", "bold");
      doc.text("5. TENANT OBLIGATIONS", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      const obligations = [
        "To pay rent on time as specified above.",
        "To keep the premises in good and clean condition.",
        "Not to sublet or assign the premises without written consent.",
        "Not to carry out any illegal activities on the premises.",
        "To allow the Landlord access for inspections with prior notice.",
        "To be responsible for utility bills (electricity, water, gas).",
      ];
      obligations.forEach((o) => {
        ensureSpace(8);
        doc.text(`• ${o}`, 25, y); y += 6;
      });
      y += 6;

      ensureSpace(50);
      doc.setFont("helvetica", "bold");
      doc.text("6. LANDLORD OBLIGATIONS", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      const landlordObs = [
        "To maintain the structural integrity of the premises.",
        "To ensure the premises are habitable at commencement.",
        "To carry out major repairs in a timely manner.",
        "To respect the Tenant's right to quiet enjoyment.",
      ];
      landlordObs.forEach((o) => {
        ensureSpace(8);
        doc.text(`• ${o}`, 25, y); y += 6;
      });
      y += 6;

      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.text("7. TERMINATION", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`Either party may terminate this agreement by giving 30 days`, 20, y); y += 6;
      doc.text(`written notice to the other party.`, 20, y); y += 12;

      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.text("8. GOVERNING LAW", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`This agreement shall be governed by the laws of the United Republic`, 20, y); y += 6;
      doc.text(`of Tanzania.`, 20, y); y += 16;

      // Signatures
      ensureSpace(30);
      doc.setDrawColor(200);
      doc.line(20, y, 80, y);
      doc.line(pageWidth - 80, y, pageWidth - 20, y);
      y += 6;
      doc.text("Tenant Signature", 20, y);
      doc.text("Landlord Signature", pageWidth - 80, y);

      doc.save(`Tenancy-Agreement-${tenant.full_name.replace(/\s+/g, "-")}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-500" /> Digital Contracts
        </h1>
        <p className="text-sm text-slate-500 mt-1">Generate tenancy agreement PDFs for tenants</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant selection */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-heading font-semibold text-slate-900 mb-4">Select Tenant</h3>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredTenants.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {tenants.length === 0 ? "No active tenants" : "No tenants match your search"}
              </p>
            ) : filteredTenants.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedId === t.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.full_name}</p>
                    <p className="text-xs text-slate-400">{t.phone || "—"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Contract preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-heading font-semibold text-slate-900 mb-4">Contract Preview</h3>
          {tenant ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-slate-500">Property</p>
                  <p className="font-medium text-slate-900">{property?.name || "—"}</p>
                  <p className="text-slate-500 text-xs">{property?.address || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Unit</p>
                  <p className="font-medium text-slate-900">{unit?.unit_number || "—"} ({unit?.type || "—"})</p>
                </div>
                <div>
                  <p className="text-slate-500">Monthly Rent</p>
                  <p className="font-medium text-slate-900">{formatTsh(tenant.monthly_rent)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Lease Start</p>
                  <p className="font-medium text-slate-900">{formatDate(tenant.lease_start)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Lease End</p>
                  <p className="font-medium text-slate-900">{formatDate(tenant.lease_end)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Tenant Name</p>
                  <p className="font-medium text-slate-900">{tenant.full_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">{tenant.phone || "—"}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                The generated PDF includes: parties, property details, rent terms, lease period, tenant & landlord obligations, termination clause, and signature section — governed by Tanzanian law.
              </div>
              <button
                onClick={generatePDF}
                disabled={generating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> {generating ? "Generating..." : "Download Contract PDF"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Select a tenant to preview contract</p>
          )}
        </div>
      </div>
    </div>
  );
}