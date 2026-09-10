import jsPDF from "jspdf";
import { formatTsh, formatDate } from "@/lib/format";

export function generateContractPdf(tenant, property, unit) {
  if (!tenant) return;
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

  doc.setFontSize(10);
  doc.text(`Date: ${formatDate(new Date().toISOString().slice(0, 10))}`, 20, y);
  y += 12;

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
    doc.text(`- ${o}`, 25, y); y += 6;
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
    doc.text(`- ${o}`, 25, y); y += 6;
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

  ensureSpace(30);
  doc.setDrawColor(200);
  doc.line(20, y, 80, y);
  doc.line(pageWidth - 80, y, pageWidth - 20, y);
  y += 6;
  doc.text("Tenant Signature", 20, y);
  doc.text("Landlord Signature", pageWidth - 80, y);

  doc.save(`Tenancy-Agreement-${tenant.full_name.replace(/\s+/g, "-")}.pdf`);
}