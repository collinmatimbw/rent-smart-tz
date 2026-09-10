import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate, statusColor } from "@/lib/format";
import jsPDF from "jspdf";
import {
  ArrowLeft, Download, Phone, Home, Wallet, Briefcase, Heart, FileText, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TenantDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [payments, setPayments] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [t, units, props, pays] = await Promise.all([
        mysql.entities.Tenant.get(id),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Payment.filter({ tenant_id: id }, "-payment_date", 50),
      ]);
      setTenant(t);
      setUnit(units.find((u) => u.id === t.unit_id));
      setProperty(props.find((p) => p.id === t.property_id));
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  }

  function generateLeasePDF() {
    if (!tenant) return;
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("TENANCY AGREEMENT", pageWidth / 2, y, { align: "center" });
      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("United Republic of Tanzania", pageWidth / 2, y, { align: "center" });
      y += 10;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;

      // Date
      doc.setFontSize(10);
      doc.text(`Date: ${formatDate(new Date().toISOString().slice(0, 10))}`, margin, y);
      y += 12;

      // Parties
      doc.setFont("helvetica", "bold");
      doc.text("THIS AGREEMENT is made between:", margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.text("THE LANDLORD (hereinafter \"the Landlord\") owner of the property known as", margin, y);
      y += 6;
      doc.text(`${property?.name || "—"} situated at ${property?.address || "—"}.`, margin, y);
      y += 10;
      doc.text("AND THE TENANT:", margin, y);
      y += 8;
      doc.text(`Name: ${tenant.full_name}`, margin, y); y += 6;
      doc.text(`Phone: ${tenant.phone || "—"}`, margin, y); y += 6;
      if (tenant.email) { doc.text(`Email: ${tenant.email}`, margin, y); y += 6; }
      if (tenant.nida_number) { doc.text(`NIDA: ${tenant.nida_number}`, margin, y); y += 6; }
      if (tenant.tin_number) { doc.text(`TIN: ${tenant.tin_number}`, margin, y); y += 6; }
      y += 6;

      const ensureSpace = (needed) => {
        if (y + needed > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
      };

      // 1. PROPERTY
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.text("1. PROPERTY", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text("The Landlord agrees to let to the Tenant the following premises:", margin, y); y += 6;
      doc.text(`Property: ${property?.name || "—"}`, margin + 5, y); y += 6;
      doc.text(`Address: ${property?.address || "—"}`, margin + 5, y); y += 6;
      doc.text(`Unit Number: ${unit?.unit_number || "—"}`, margin + 5, y); y += 6;
      doc.text(`Unit Type: ${unit?.type || "—"}`, margin + 5, y); y += 6;
      doc.text(`Property Type: ${property?.type || "—"}`, margin + 5, y); y += 12;

      // 2. TERM
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.text("2. TERM OF TENANCY", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`The tenancy shall commence on ${formatDate(tenant.lease_start)} and`, margin, y); y += 6;
      doc.text(`terminate on ${formatDate(tenant.lease_end)}, unless renewed.`, margin, y); y += 12;

      // 3. RENT
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.text("3. RENT", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`The Tenant shall pay a monthly rent of ${formatTsh(tenant.monthly_rent)}.`, margin, y); y += 6;
      doc.text("Rent shall be payable on or before the 5th day of each calendar month.", margin, y); y += 6;
      doc.text("Late payment shall attract a penalty of 5% of the monthly rent.", margin, y); y += 12;

      // 4. PAYMENT
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.text("4. PAYMENT METHOD", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text("Rent shall be paid via mobile money (M-Pesa, Tigo Pesa, Airtel Money),", margin, y); y += 6;
      doc.text("bank transfer, or cash to the Landlord or designated agent.", margin, y); y += 12;

      // 5. TENANT OBLIGATIONS
      const obligations = [
        "To pay rent on time as specified above.",
        "To keep the premises in good and clean condition.",
        "Not to sublet or assign the premises without written consent.",
        "Not to carry out any illegal activities on the premises.",
        "To allow the Landlord access for inspections with prior notice.",
        "To be responsible for utility bills (electricity, water, gas).",
      ];
      ensureSpace(8 + obligations.length * 6);
      doc.setFont("helvetica", "bold");
      doc.text("5. TENANT OBLIGATIONS", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      obligations.forEach((o) => { doc.text(`• ${o}`, margin + 5, y); y += 6; });
      y += 6;

      // 6. LANDLORD OBLIGATIONS
      const landlordObs = [
        "To maintain the structural integrity of the premises.",
        "To ensure the premises are habitable at commencement.",
        "To carry out major repairs in a timely manner.",
        "To respect the Tenant's right to quiet enjoyment.",
      ];
      ensureSpace(8 + landlordObs.length * 6);
      doc.setFont("helvetica", "bold");
      doc.text("6. LANDLORD OBLIGATIONS", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      landlordObs.forEach((o) => { doc.text(`• ${o}`, margin + 5, y); y += 6; });
      y += 6;

      // 7. TERMINATION
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.text("7. TERMINATION", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text("Either party may terminate this agreement by giving 30 days", margin, y); y += 6;
      doc.text("written notice to the other party.", margin, y); y += 12;

      // 8. GOVERNING LAW
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.text("8. GOVERNING LAW", margin, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text("This agreement shall be governed by the laws of the United Republic", margin, y); y += 6;
      doc.text("of Tanzania.", margin, y); y += 20;

      // Signatures
      ensureSpace(20);
      doc.setDrawColor(200);
      doc.line(margin, y, margin + 60, y);
      doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
      y += 6;
      doc.text("Tenant Signature", margin, y);
      doc.text("Landlord Signature", pageWidth - margin - 60, y);

      doc.save(`Lease-Agreement-${tenant.full_name.replace(/\s+/g, "-")}.pdf`);
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

  if (!tenant) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500">Tenant not found.</p>
        <Link to="/tenants" className="text-sm text-slate-900 underline mt-2 inline-block">Back to Tenants</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/tenants" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-slate-900">{tenant.full_name}</h1>
            <p className="text-sm text-slate-500">Tenant Profile</p>
          </div>
        </div>
        <Button onClick={generateLeasePDF} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? "Generating..." : "Download Lease Agreement"}
        </Button>
      </div>

      {/* Lease & Unit Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Unit & Lease</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Property" value={property?.name || "—"} />
            <DetailRow label="Address" value={property?.address || "—"} />
            <DetailRow label="Unit Number" value={unit?.unit_number || "—"} />
            <DetailRow label="Unit Type" value={unit?.type || "—"} />
            <DetailRow label="Lease Start" value={formatDate(tenant.lease_start)} />
            <DetailRow label="Lease End" value={formatDate(tenant.lease_end)} />
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Financials</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Monthly Rent" value={formatTsh(tenant.monthly_rent)} />
            <DetailRow label="Outstanding Balance" value={formatTsh(tenant.balance)} valueClass={tenant.balance > 0 ? "text-rose-600 font-medium" : ""} />
            <div className="pt-2">
              <span className="text-slate-500">Status</span>
              <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${statusColor(tenant.status)}`}>{tenant.status}</span>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Contact</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Phone" value={tenant.phone || "—"} />
            <DetailRow label="Email" value={tenant.email || "—"} />
            <DetailRow label="NIDA" value={tenant.nida_number || "—"} />
            <DetailRow label="Passport" value={tenant.passport_number || "—"} />
            <DetailRow label="TIN" value={tenant.tin_number || "—"} />
          </dl>
        </div>
      </div>

      {/* Employment & Next of Kin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Employment</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Employer" value={tenant.employer || "—"} />
            <DetailRow label="Employer Phone" value={tenant.employer_phone || "—"} />
          </dl>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Next of Kin</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Name" value={tenant.next_of_kin_name || "—"} />
            <DetailRow label="Phone" value={tenant.next_of_kin_phone || "—"} />
            <DetailRow label="Relationship" value={tenant.next_of_kin_relation || "—"} />
          </dl>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Payment History</h3>
          </div>
          <Link to="/payments" className="text-xs font-medium text-slate-500 hover:text-slate-900">View all</Link>
        </div>
        {payments.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No payments recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Period</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Method</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Amount</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.period || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.method}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatTsh(p.amount)}</td>
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
    </div>
  );
}

function DetailRow({ label, value, valueClass }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-slate-900 text-right ${valueClass || ""}`}>{value}</dd>
    </div>
  );
}