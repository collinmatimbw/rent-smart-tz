import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { mysql } from "@/api/mysqlClient";
import { formatTsh, formatDate } from "@/lib/format";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle, CalendarClock, Phone, Zap, Wrench, Users, RefreshCw, ArrowRight,
  TrendingDown, Bell, Clock,
} from "lucide-react";

export default function Notifications() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [overdueTenants, setOverdueTenants] = useState([]);
  const [expiringLeases, setExpiringLeases] = useState([]);
  const [leadFollowUps, setLeadFollowUps] = useState([]);
  const [unpaidUtilities, setUnpaidUtilities] = useState([]);
  const [urgentMaintenance, setUrgentMaintenance] = useState([]);
  const [vacantUnits, setVacantUnits] = useState([]);
  const [highlight, setHighlight] = useState(null);
  const [rentReminders, setRentReminders] = useState([]);
  const [paymentDueSoon, setPaymentDueSoon] = useState([]);
  const [generating, setGenerating] = useState(false);
  const loadingRef = useRef(false);

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    setTimeout(() => setHighlight(null), 2000);
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const loadAlerts = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [tenants, payments, leads, utilities, requests, units, reminders] = await Promise.all([
        mysql.entities.Tenant.filter({ status: "Active" }, "-created_date", 500),
        mysql.entities.Payment.list("-created_date", 500),
        mysql.entities.Lead.list("-created_date", 500),
        mysql.entities.Utility.list("-reading_date", 500),
        mysql.entities.MaintenanceRequest.list("-reported_date", 200),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.RentReminder.list("-reminder_date", 500),
      ]);

      const paidIds = new Set(
        payments
          .filter((p) => p.period === currentMonth && p.status === "Completed")
          .map((p) => p.tenant_id)
      );

      setOverdueTenants(tenants.filter((t) => !paidIds.has(t.id)));
      setExpiringLeases(
        tenants.filter((t) => {
          if (!t.lease_end) return false;
          const end = new Date(t.lease_end);
          return end >= now && end <= thirtyDays;
        })
      );
      setLeadFollowUps(
        leads.filter(
          (l) =>
            l.status !== "Converted" &&
            l.status !== "Lost" &&
            l.follow_up_date &&
            new Date(l.follow_up_date) <= thirtyDays
        )
      );
      setUnpaidUtilities(utilities.filter((u) => u.status === "Unpaid"));
      setUrgentMaintenance(
        requests.filter((r) => r.status === "Open" && (r.priority === "High" || r.priority === "Urgent"))
      );
      setVacantUnits(units.filter((u) => u.status === "Vacant"));
      setRentReminders(reminders);

      // Calculate payment due soon (based on lease_start day of month)
      const todayDate = new Date();
      const currentDay = todayDate.getDate();
      const dueSoon = [];
      for (const t of tenants) {
        if (!t.lease_start) continue;
        const leaseDay = new Date(t.lease_start).getDate();
        let daysUntilDue = leaseDay - currentDay;
        if (daysUntilDue < 0) {
          const nextMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, leaseDay);
          daysUntilDue = Math.ceil((nextMonth - todayDate) / (1000 * 60 * 60 * 24));
        }
        if (daysUntilDue >= 0 && daysUntilDue <= 7) {
          const hasPaid = payments.some((p) => p.tenant_id === t.id && p.status === "Completed");
          if (!hasPaid) {
            dueSoon.push({ ...t, daysUntilDue, dueDate: leaseDay });
          }
        }
      }
      setPaymentDueSoon(dueSoon);

      setLastUpdated(new Date());
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const unsubs = [
      mysql.entities.Tenant.subscribe(() => loadAlerts()),
      mysql.entities.Payment.subscribe(() => loadAlerts()),
      mysql.entities.Lead.subscribe(() => loadAlerts()),
      mysql.entities.Utility.subscribe(() => loadAlerts()),
      mysql.entities.MaintenanceRequest.subscribe(() => loadAlerts()),
      mysql.entities.Unit.subscribe(() => loadAlerts()),
      mysql.entities.RentReminder.subscribe(() => loadAlerts()),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [loadAlerts]);

  async function generateReminders() {
    setGenerating(true);
    try {
      await mysql.functions.invoke("generateRentReminders", {});
      await loadAlerts();
    } catch (e) {
      alert(e.message || "Failed to send reminders. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const totalAlerts =
    overdueTenants.length +
    paymentDueSoon.length +
    expiringLeases.length +
    leadFollowUps.length +
    unpaidUtilities.length +
    urgentMaintenance.length;

  const totalOverdueAmount = overdueTenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
  const totalUnpaidUtilities = unpaidUtilities.reduce((s, u) => s + (u.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6" /> Notifications & Alerts
            {totalAlerts > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-rose-500 rounded-full">
                {totalAlerts}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "All actionable alerts in one place"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateReminders}
            disabled={generating}
            className="inline-flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {generating ? "Sending..." : "Send Reminders"}
          </button>
          <button
            onClick={loadAlerts}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Overdue Rent" value={overdueTenants.length} sub={formatTsh(totalOverdueAmount)} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-50" onClick={() => scrollToSection("alert-overdue")} />
        <StatCard label="Payment Due Soon" value={paymentDueSoon.length} sub="Within 7 days" icon={Clock} color="text-orange-600" bg="bg-orange-50" onClick={() => scrollToSection("alert-due-soon")} />
        <StatCard label="Expiring Leases" value={expiringLeases.length} sub="Next 30 days" icon={CalendarClock} color="text-orange-600" bg="bg-orange-50" onClick={() => scrollToSection("alert-expiring")} />
        <StatCard label="Lead Follow-ups" value={leadFollowUps.length} sub="Due soon" icon={Phone} color="text-blue-600" bg="bg-blue-50" onClick={() => scrollToSection("alert-leads")} />
        <StatCard label="Unpaid Utilities" value={unpaidUtilities.length} sub={formatTsh(totalUnpaidUtilities)} icon={Zap} color="text-amber-600" bg="bg-amber-50" onClick={() => scrollToSection("alert-utilities")} />
        <StatCard label="Urgent Repairs" value={urgentMaintenance.length} sub="High priority" icon={Wrench} color="text-red-600" bg="bg-red-50" onClick={() => scrollToSection("alert-maintenance")} />
      </div>

      {/* Alert sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Rent */}
        <AlertSection
          id="alert-overdue"
          highlight={highlight === "alert-overdue"}
          title="Overdue Rent This Month"
          icon={AlertTriangle}
          color="rose"
          link="/payments"
          items={overdueTenants.map((t) => ({
            id: t.id,
            primary: t.full_name,
            secondary: `${t.phone || "No phone"} · ${formatTsh(t.monthly_rent)} rent`,
            badge: `${formatTsh(t.monthly_rent)} unpaid`,
          }))}
          emptyText="All tenants have paid this month"
        />

        {/* Payment Due Soon */}
        <AlertSection
          id="alert-due-soon"
          highlight={highlight === "alert-due-soon"}
          title="Payment Due Soon (7 days)"
          icon={Clock}
          color="amber"
          link="/payments"
          items={paymentDueSoon.map((t) => ({
            id: t.id,
            primary: t.full_name,
            secondary: `${t.phone || "No phone"} · ${formatTsh(t.monthly_rent)} rent`,
            badge: t.daysUntilDue === 0 ? "Due today" : `Due in ${t.daysUntilDue} day${t.daysUntilDue > 1 ? "s" : ""}`,
          }))}
          emptyText="No payments due within 7 days"
        />

        {/* Expiring Leases */}
        <AlertSection
          id="alert-expiring"
          highlight={highlight === "alert-expiring"}
          title="Leases Expiring (30 days)"
          icon={CalendarClock}
          color="orange"
          link="/tenants"
          items={expiringLeases.map((t) => ({
            id: t.id,
            primary: t.full_name,
            secondary: t.phone || "No phone",
            badge: `Expires ${formatDate(t.lease_end)}`,
          }))}
          emptyText="No leases expiring soon"
        />

        {/* Lead Follow-ups */}
        <AlertSection
          id="alert-leads"
          highlight={highlight === "alert-leads"}
          title="Lead Follow-ups Due"
          icon={Phone}
          color="blue"
          link="/leads"
          items={leadFollowUps.map((l) => ({
            id: l.id,
            primary: l.full_name,
            secondary: `${l.phone || "No phone"} · ${l.status}`,
            badge: l.follow_up_date ? formatDate(l.follow_up_date) : "",
          }))}
          emptyText="No follow-ups scheduled"
        />

        {/* Unpaid Utilities */}
        <AlertSection
          id="alert-utilities"
          highlight={highlight === "alert-utilities"}
          title="Unpaid Utility Bills"
          icon={Zap}
          color="amber"
          link="/utilities"
          items={unpaidUtilities.map((u) => ({
            id: u.id,
            primary: `${u.utility_type} · ${formatTsh(u.amount)}`,
            secondary: `Period: ${u.period || "N/A"}`,
            badge: u.status,
          }))}
          emptyText="All utility bills are paid"
        />

        {/* Urgent Maintenance */}
        <AlertSection
          id="alert-maintenance"
          highlight={highlight === "alert-maintenance"}
          title="Urgent Maintenance Requests"
          icon={Wrench}
          color="red"
          link="/maintenance"
          items={urgentMaintenance.map((r) => ({
            id: r.id,
            primary: r.title,
            secondary: formatDate(r.reported_date),
            badge: r.priority,
          }))}
          emptyText="No urgent maintenance issues"
        />

        {/* Vacant Units */}
        <AlertSection
          id="alert-vacant"
          highlight={highlight === "alert-vacant"}
          title="Vacant Units"
          icon={Users}
          color="slate"
          link="/properties"
          items={vacantUnits.map((u) => ({
            id: u.id,
            primary: `Unit ${u.unit_number} (${u.type})`,
            secondary: `${formatTsh(u.rent_amount)} / month`,
            badge: "Vacant",
          }))}
          emptyText="All units are occupied"
        />

        {/* Rent Reminders Sent */}
        <AlertSection
          id="alert-reminders"
          highlight={highlight === "alert-reminders"}
          title="Sent Rent Reminders"
          icon={Bell}
          color="amber"
          link="/payments"
          items={rentReminders.map((r) => {
            const tenant = overdueTenants.find((t) => t.id === r.tenant_id);
            const name = tenant?.full_name || "Tenant";
            return {
              id: r.id,
              primary: name,
              secondary: `${r.period} · ${formatDate(r.reminder_date)}`,
              badge: formatTsh(r.amount_due),
            };
          })}
          emptyText="No reminders sent yet"
        />
      </div>
    </div>
  );
}

function AlertSection({ id, highlight, title, icon: Icon, color, link, items, emptyText }) {
  const colors = {
    rose: { bg: "bg-rose-50", text: "text-rose-600", badge: "bg-rose-100 text-rose-700" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
    red: { bg: "bg-red-50", text: "text-red-600", badge: "bg-red-100 text-red-700" },
    slate: { bg: "bg-slate-50", text: "text-slate-600", badge: "bg-slate-100 text-slate-700" },
  };
  const c = colors[color] || colors.slate;

  return (
    <div
      id={id}
      className={`bg-white rounded-xl border transition-all duration-500 ${
        highlight ? "border-slate-400 ring-2 ring-slate-200 shadow-md" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${c.text}`} />
          </div>
          <h3 className="font-heading font-semibold text-slate-900">{title}</h3>
          {items.length > 0 && (
            <span className="text-xs font-medium text-slate-400">({items.length})</span>
          )}
        </div>
        {items.length > 0 && (
          <Link to={link} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{item.primary}</p>
                <p className="text-xs text-slate-400">{item.secondary}</p>
              </div>
              {item.badge && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.badge} whitespace-nowrap`}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}