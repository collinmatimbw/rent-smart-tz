import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { mysql } from "@/api/mysqlClient";
import StatCard from "@/components/StatCard";
import DashboardDetailModal from "@/components/DashboardDetailModal";
import RentCalendar from "@/components/RentCalendar";
import FinancialReport from "@/components/FinancialReport";
import PropertyCollectionReport from "@/components/PropertyCollectionReport";
import { formatTsh, statusColor, priorityColor, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";
import { canSeeFinances } from "@/lib/roles";
import {
  Building2, Home, CheckCircle2, XCircle, CalendarDays, TrendingUp,
  Wallet, AlertTriangle, Wrench, FileWarning, Zap, Droplet, ArrowRight, RefreshCw,
} from "lucide-react";

const Th = ({ children, right }) => (
  <th className={`${right ? "text-right" : "text-left"} font-medium text-slate-600 px-4 py-2`}>{children}</th>
);
const Td = ({ children, right }) => (
  <td className={`px-4 py-2 text-slate-600 ${right ? "text-right" : ""}`}>{children}</td>
);

export default function Dashboard() {
  const { user } = useAuth();
  const showFinances = canSeeFinances(user?.role);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    totalTenants: 0,
    todaysCollections: 0,
    monthlyCollected: 0,
    monthlyExpected: 0,
    outstandingBalance: 0,
    openMaintenance: 0,
    expiringContracts: 0,
    netProfit: 0,
    monthlyExpenses: 0,
    electricityBalance: 0,
    waterBalance: 0,
  });
  const [recentPayments, setRecentPayments] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [expiringList, setExpiringList] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allUtilities, setAllUtilities] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [modal, setModal] = useState(null);
  const loadingRef = useRef(false);

  const loadDashboard = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [properties, units, tenants, requests, utilities] = await Promise.all([
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.Tenant.filter({ status: "Active" }, "-created_date", 500),
        mysql.entities.MaintenanceRequest.filter({ status: "Open" }, "-reported_date", 500),
        mysql.entities.Utility.list("-reading_date", 500),
      ]);

      let payments = [];
      let expenses = [];
      if (showFinances) {
        [payments, expenses] = await Promise.all([
          mysql.entities.Payment.list("-created_date", 500),
          mysql.entities.Expense.list("-date", 500),
        ]);
      }

      const occupied = units.filter((u) => u.status === "Occupied").length;
      const vacant = units.filter((u) => u.status === "Vacant").length;
      const monthlyExpected = tenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
      const outstandingBalance = tenants.reduce((s, t) => s + (t.balance || 0), 0);

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const today = now.toISOString().slice(0, 10);

      const todaysCollections = payments
        .filter((p) => p.payment_date === today && p.status === "Completed")
        .reduce((s, p) => s + (p.amount || 0), 0);
      const monthlyCollected = payments
        .filter((p) => p.period === currentMonth && p.status === "Completed")
        .reduce((s, p) => s + (p.amount || 0), 0);
      const monthlyExpenses = expenses
        .filter((e) => e.date && e.date.slice(0, 7) === currentMonth)
        .reduce((s, e) => s + (e.amount || 0), 0);
      const netProfit = monthlyCollected - monthlyExpenses;

      const electricityBalance = utilities
        .filter((u) => u.utility_type === "Electricity" && u.status === "Unpaid")
        .reduce((s, u) => s + (u.amount || 0), 0);
      const waterBalance = utilities
        .filter((u) => u.utility_type === "Water" && u.status === "Unpaid")
        .reduce((s, u) => s + (u.amount || 0), 0);

      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiring = tenants.filter((t) => {
        if (!t.lease_end) return false;
        const endDate = new Date(t.lease_end);
        return endDate >= now && endDate <= thirtyDaysFromNow;
      });

      setStats({
        totalBuildings: properties.length,
        totalUnits: units.length,
        occupiedUnits: occupied,
        vacantUnits: vacant,
        totalTenants: tenants.length,
        todaysCollections,
        monthlyCollected,
        monthlyExpected,
        outstandingBalance,
        openMaintenance: requests.length,
        expiringContracts: expiring.length,
        monthlyExpenses,
        netProfit,
        electricityBalance,
        waterBalance,
      });
      setAllProperties(properties);
      setAllUnits(units);
      setAllTenants(tenants);
      setAllPayments(payments);
      setAllExpenses(expenses);
      setAllUtilities(utilities);
      setAllRequests(requests);
      setRecentPayments(payments.slice(0, 6));
      setOpenRequests(requests.slice(0, 5));
      setExpiringList(expiring.slice(0, 5));
      setLastUpdated(new Date());
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [showFinances]);

  useEffect(() => {
    loadDashboard();
    const unsubs = [
      mysql.entities.Tenant.subscribe(() => loadDashboard()),
      mysql.entities.Unit.subscribe(() => loadDashboard()),
      mysql.entities.Property.subscribe(() => loadDashboard()),
      mysql.entities.MaintenanceRequest.subscribe(() => loadDashboard()),
      mysql.entities.Utility.subscribe(() => loadDashboard()),
    ];
    if (showFinances) {
      unsubs.push(
        mysql.entities.Payment.subscribe(() => loadDashboard()),
        mysql.entities.Expense.subscribe(() => loadDashboard()),
      );
    }
    return () => unsubs.forEach((u) => u && u());
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  const occupancyRate = stats.totalUnits > 0 ? Math.round((stats.occupiedUnits / stats.totalUnits) * 100) : 0;
  const collectionRate = stats.monthlyExpected > 0 ? Math.round((stats.monthlyCollected / stats.monthlyExpected) * 100) : 0;
  const tenantName = (id) => allTenants.find((t) => t.id === id)?.full_name || "—";
  const propName = (id) => allProperties.find((p) => p.id === id)?.name || "—";
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            Dashboard
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Overview of your property portfolio"}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Portfolio */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Portfolio</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard label="Total Buildings" value={stats.totalBuildings} sub="Registered properties" icon={Building2} color="text-blue-600" bg="bg-blue-50" onClick={() => setModal({ type: "properties", title: "All Properties", sub: `${allProperties.length} registered` })} />
          <StatCard label="Total Units" value={stats.totalUnits} sub={`${stats.totalTenants} active tenants`} icon={Home} color="text-slate-600" bg="bg-slate-50" onClick={() => setModal({ type: "units", title: "All Units", sub: `${allUnits.length} total units` })} />
          <StatCard label="Occupied" value={stats.occupiedUnits} sub={`${occupancyRate}% occupancy`} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" onClick={() => setModal({ type: "occupied", title: "Occupied Units", sub: `${stats.occupiedUnits} occupied` })} />
          <StatCard label="Vacant" value={stats.vacantUnits} sub="Available units" icon={XCircle} color="text-rose-600" bg="bg-rose-50" onClick={() => setModal({ type: "vacant", title: "Vacant Units", sub: `${stats.vacantUnits} available` })} />
        </div>
      </div>

      {/* Financials */}
      {showFinances && (
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Financials</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Collections" value={formatTsh(stats.todaysCollections)} sub="Payments received today" icon={Wallet} color="text-indigo-600" bg="bg-indigo-50" onClick={() => setModal({ type: "today", title: "Today's Collections", sub: formatTsh(stats.todaysCollections) })} />
          <StatCard label="This Month Revenue" value={formatTsh(stats.monthlyCollected)} sub={`${collectionRate}% collected`} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" onClick={() => setModal({ type: "monthRevenue", title: "This Month's Revenue", sub: formatTsh(stats.monthlyCollected) })} />
          <StatCard label="Expected Revenue" value={formatTsh(stats.monthlyExpected)} sub="Monthly rent total" icon={CalendarDays} color="text-blue-600" bg="bg-blue-50" onClick={() => setModal({ type: "expected", title: "Expected Monthly Revenue", sub: formatTsh(stats.monthlyExpected) })} />
          <StatCard label="Outstanding Rent" value={formatTsh(stats.outstandingBalance)} sub="Tenant balances" icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50" onClick={() => setModal({ type: "outstanding", title: "Outstanding Rent Balances", sub: formatTsh(stats.outstandingBalance) })} />
        </div>
      </div>
      )}

      {/* Operations & Utilities */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Operations & Utilities</h2>
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${showFinances ? "lg:grid-cols-5" : "lg:grid-cols-2"} gap-4`}>
          <StatCard label="Maintenance" value={stats.openMaintenance} sub="Open requests" icon={Wrench} color="text-amber-600" bg="bg-amber-50" onClick={() => setModal({ type: "maintenance", title: "Open Maintenance Requests", sub: `${allRequests.length} open` })} />
          <StatCard label="Contracts Expiring" value={stats.expiringContracts} sub="Next 30 days" icon={FileWarning} color="text-orange-600" bg="bg-orange-50" onClick={() => setModal({ type: "expiring", title: "Expiring Contracts", sub: "Next 30 days" })} />
          {showFinances && <>
          <StatCard label="Electricity Balance" value={formatTsh(stats.electricityBalance)} sub="Unpaid bills" icon={Zap} color="text-yellow-600" bg="bg-yellow-50" onClick={() => setModal({ type: "electricity", title: "Unpaid Electricity Bills", sub: formatTsh(stats.electricityBalance) })} />
          <StatCard label="Water Balance" value={formatTsh(stats.waterBalance)} sub="Unpaid bills" icon={Droplet} color="text-cyan-600" bg="bg-cyan-50" onClick={() => setModal({ type: "water", title: "Unpaid Water Bills", sub: formatTsh(stats.waterBalance) })} />
          <StatCard
            label="Profit (Month)"
            value={formatTsh(stats.netProfit)}
            sub={`${formatTsh(stats.monthlyCollected)} - ${formatTsh(stats.monthlyExpenses)}`}
            icon={TrendingUp}
            color={stats.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
            bg={stats.netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"}
            onClick={() => setModal({ type: "profit", title: "Monthly Profit Breakdown", sub: `Net: ${formatTsh(stats.netProfit)}` })}
          />
          </>
          }
        </div>
      </div>

      {/* Financial Report */}
      {showFinances && <FinancialReport payments={allPayments} expenses={allExpenses} currentMonth={currentMonth} />}

      {/* Property Collection Report */}
      {showFinances && <PropertyCollectionReport payments={allPayments} tenants={allTenants} properties={allProperties} currentMonth={currentMonth} />}

      {/* Rent Calendar */}
      {showFinances && <RentCalendar payments={allPayments} tenants={allTenants} currentMonth={currentMonth} />}

      {/* Occupancy + Collection bars */}
      <div className={`grid grid-cols-1 ${showFinances ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-slate-900">Occupancy Rate</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-heading font-bold text-slate-900">{occupancyRate}%</span>
            <span className="text-sm text-slate-500 mb-1">{stats.occupiedUnits} of {stats.totalUnits} units</span>
          </div>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${occupancyRate}%` }} />
          </div>
        </div>

        {showFinances && <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-slate-900">Rent Collection This Month</h3>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-heading font-bold text-slate-900">{collectionRate}%</span>
            <span className="text-sm text-slate-500 mb-1">{formatTsh(stats.monthlyCollected)} / {formatTsh(stats.monthlyExpected)}</span>
          </div>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>}
      </div>

      {/* Recent payments + Open maintenance */}
      <div className={`grid grid-cols-1 ${showFinances ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
        {showFinances && <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-slate-900">Recent Payments</h3>
            <Link to="/payments" className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No payments recorded yet</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{formatTsh(p.amount)}</p>
                    <p className="text-xs text-slate-400">{p.method} · {formatDate(p.payment_date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>}

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-slate-900">Open Maintenance Requests</h3>
            <Link to="/maintenance" className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {openRequests.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No open maintenance requests</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {openRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400">{formatDate(r.reported_date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${priorityColor(r.priority)}`}>{r.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expiring contracts */}
      {expiringList.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-slate-900">Contracts Expiring (30 days)</h3>
            <Link to="/tenants" className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {expiringList.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.full_name}</p>
                  <p className="text-xs text-slate-400">{t.phone}</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                  Expires {formatDate(t.lease_end)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal && (
        <DashboardDetailModal title={modal.title} sub={modal.sub} onClose={() => setModal(null)}>
          {/* Properties */}
          {modal.type === "properties" && (
            allProperties.length === 0 ? <p className="p-8 text-center text-slate-400">No properties found</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Name</Th><Th>Address</Th><Th>Type</Th><Th right>Units</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allProperties.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50"><Td>{p.name}</Td><Td>{p.address || "—"}</Td><Td>{p.type}</Td><Td right>{p.unit_count || "—"}</Td></tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Units */}
          {(modal.type === "units" || modal.type === "occupied" || modal.type === "vacant") && (() => {
            const filtered = modal.type === "units" ? allUnits : allUnits.filter((u) => u.status === (modal.type === "occupied" ? "Occupied" : "Vacant"));
            return filtered.length === 0 ? <p className="p-8 text-center text-slate-400">No units found</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Unit #</Th><Th>Property</Th><Th>Type</Th><Th right>Rent</Th><Th>Status</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50"><Td>{u.unit_number}</Td><Td>{propName(u.property_id)}</Td><Td>{u.type}</Td><Td right>{formatTsh(u.rent_amount)}</Td><Td><span className={`text-xs px-2 py-1 rounded-full ${statusColor(u.status)}`}>{u.status}</span></Td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {/* Today's Collections */}
          {modal.type === "today" && (() => {
            const filtered = allPayments.filter((p) => p.payment_date === todayStr && p.status === "Completed");
            return filtered.length === 0 ? <p className="p-8 text-center text-slate-400">No payments collected today</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Tenant</Th><Th>Method</Th><Th>Reference</Th><Th right>Amount</Th><Th>Status</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50"><Td>{tenantName(p.tenant_id)}</Td><Td>{p.method}</Td><Td>{p.reference || "—"}</Td><Td right>{formatTsh(p.amount)}</Td><Td><span className={`text-xs px-2 py-1 rounded-full ${statusColor(p.status)}`}>{p.status}</span></Td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {/* Month Revenue */}
          {modal.type === "monthRevenue" && (() => {
            const filtered = allPayments.filter((p) => p.period === currentMonth && p.status === "Completed");
            return filtered.length === 0 ? <p className="p-8 text-center text-slate-400">No payments this month</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Tenant</Th><Th>Date</Th><Th>Method</Th><Th right>Amount</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50"><Td>{tenantName(p.tenant_id)}</Td><Td>{formatDate(p.payment_date)}</Td><Td>{p.method}</Td><Td right>{formatTsh(p.amount)}</Td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {/* Expected Revenue */}
          {modal.type === "expected" && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr><Th>Tenant</Th><Th>Phone</Th><Th right>Monthly Rent</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50"><Td>{t.full_name}</Td><Td>{t.phone || "—"}</Td><Td right>{formatTsh(t.monthly_rent)}</Td></tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Outstanding Rent */}
          {modal.type === "outstanding" && (() => {
            const filtered = allTenants.filter((t) => (t.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0));
            return filtered.length === 0 ? <p className="p-8 text-center text-slate-400">No outstanding balances ðŸŽ‰</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Tenant</Th><Th>Phone</Th><Th right>Balance</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50"><Td>{t.full_name}</Td><Td>{t.phone || "—"}</Td><Td right><span className="font-medium text-rose-600">{formatTsh(t.balance)}</span></Td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {/* Maintenance */}
          {modal.type === "maintenance" && (
            allRequests.length === 0 ? <p className="p-8 text-center text-slate-400">No open maintenance requests</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Issue</Th><Th>Property</Th><Th>Date</Th><Th>Priority</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50"><Td>{r.title}</Td><Td>{propName(r.property_id)}</Td><Td>{formatDate(r.reported_date)}</Td><Td><span className={`text-xs px-2 py-1 rounded-full ${priorityColor(r.priority)}`}>{r.priority}</span></Td></tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Expiring Contracts */}
          {modal.type === "expiring" && (
            expiringList.length === 0 ? <p className="p-8 text-center text-slate-400">No contracts expiring soon</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Tenant</Th><Th>Phone</Th><Th right>Expires</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expiringList.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50"><Td>{t.full_name}</Td><Td>{t.phone || "—"}</Td><Td right><span className="font-medium text-orange-600">{formatDate(t.lease_end)}</span></Td></tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Electricity / Water */}
          {(modal.type === "electricity" || modal.type === "water") && (() => {
            const filtered = allUtilities.filter((u) => u.utility_type === (modal.type === "electricity" ? "Electricity" : "Water") && u.status === "Unpaid");
            return filtered.length === 0 ? <p className="p-8 text-center text-slate-400">No unpaid bills</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr><Th>Property</Th><Th>Period</Th><Th>Consumption</Th><Th right>Amount</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50"><Td>{propName(u.property_id)}</Td><Td>{u.period || "—"}</Td><Td>{u.consumption || 0} units</Td><Td right>{formatTsh(u.amount)}</Td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {/* Profit */}
          {modal.type === "profit" && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-5">
                  <p className="text-sm text-emerald-700 font-medium">Revenue</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">{formatTsh(stats.monthlyCollected)}</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-5">
                  <p className="text-sm text-rose-700 font-medium">Expenses</p>
                  <p className="text-2xl font-bold text-rose-900 mt-1">{formatTsh(stats.monthlyExpenses)}</p>
                </div>
                <div className={`rounded-xl p-5 ${stats.netProfit >= 0 ? "bg-emerald-100" : "bg-rose-100"}`}>
                  <p className={`text-sm font-medium ${stats.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>Net Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.netProfit >= 0 ? "text-emerald-900" : "text-rose-900"}`}>{formatTsh(stats.netProfit)}</p>
                </div>
              </div>
              {allExpenses.filter((e) => e.date && e.date.slice(0, 7) === currentMonth).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Expense Breakdown This Month</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr><Th>Description</Th><Th>Category</Th><Th right>Amount</Th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allExpenses.filter((e) => e.date && e.date.slice(0, 7) === currentMonth).map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50"><Td>{e.description}</Td><Td>{e.category}</Td><Td right>{formatTsh(e.amount)}</Td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </DashboardDetailModal>
      )}
    </div>
  );
}