import React, { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { formatTsh, formatDate } from "@/lib/format";
import { CalendarDays, AlertCircle, CheckCircle2, Clock } from "lucide-react";

function dateToStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function RentCalendar({ payments, tenants, currentMonth }) {
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const dueDay = 5;

  // Map payment_date -> array of payments (completed only)
  const paymentDates = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      if (p.status !== "Completed" || !p.payment_date) return;
      if (!map[p.payment_date]) map[p.payment_date] = [];
      map[p.payment_date].push(p);
    });
    return map;
  }, [payments]);

  // Overdue tenants for current month
  const paidTenantIds = useMemo(
    () => new Set(
      payments.filter((p) => p.period === currentMonth && p.status === "Completed").map((p) => p.tenant_id)
    ),
    [payments, currentMonth]
  );
  const overdueTenants = useMemo(
    () => tenants.filter((t) => !paidTenantIds.has(t.id)),
    [tenants, paidTenantIds]
  );

  const selectedPayments = selectedDate ? (paymentDates[selectedDate] || []) : [];
  const now = new Date();
  const isPastDue = now.getDate() > dueDay;
  const totalOverdueAmount = overdueTenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-500" />
          <h3 className="font-heading font-semibold text-slate-900">Kalenda ya Malipo ya Kodi</h3>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Malipo yamefanyika
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 border-2 border-rose-400 rounded-full" /> Mwisho wa kodi
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Calendar */}
        <div className="p-4 border-b lg:border-b-0 lg:border-r border-slate-100">
          <Calendar
            mode="single"
            selected={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
            month={month}
            onMonthChange={setMonth}
            onSelect={(d) => setSelectedDate(d ? dateToStr(d) : null)}
            modifiers={{
              paid: (date) => !!paymentDates[dateToStr(date)],
              due: (date) => date.getDate() === dueDay,
            }}
            modifiersClassNames={{
              paid: "bg-emerald-50 text-emerald-700 font-semibold",
              due: "ring-2 ring-rose-400 ring-inset",
            }}
            className="mx-auto"
          />

          {/* Summary */}
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Tarehe ya mwisho ya kodi:
              </span>
              <span className={`font-medium ${isPastDue ? "text-rose-600" : "text-slate-900"}`}>
                Siku ya {dueDay} {isPastDue ? "· Imechelewa" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Wamalipo (mwezi huu):</span>
              <span className="font-medium text-emerald-600">{paidTenantIds.size} wapangaji</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Wanaochelewa:</span>
              <span className="font-medium text-rose-600">{overdueTenants.length} wapangaji</span>
            </div>
            {overdueTenants.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Jumla ya deni:</span>
                <span className="font-bold text-rose-600">{formatTsh(totalOverdueAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Side panel: overdue tenants or selected date payments */}
        <div className="p-4 max-h-[420px] overflow-y-auto">
          {selectedDate ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">Malipo ya {formatDate(selectedDate)}</h4>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ← Rudi kwenye wanaochelewa
                </button>
              </div>
              {selectedPayments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Hakuna malipo yaliyoandikwa siku hii</p>
              ) : (
                <div className="space-y-2">
                  {selectedPayments.map((p) => {
                    const tenant = tenants.find((t) => t.id === p.tenant_id);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{tenant?.full_name || "—"}</p>
                          <p className="text-xs text-slate-500">{p.method} · {p.reference || "—"}</p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600">{formatTsh(p.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                Wapangaji Wanaochelewa ({overdueTenants.length})
              </h4>
              {overdueTenants.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Wapangaji wote wamelipa kwa mwezi wa {currentMonth}!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {overdueTenants.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{t.full_name}</p>
                        <p className="text-xs text-slate-400">{t.phone || "—"}</p>
                      </div>
                      <span className="text-sm font-medium text-rose-600">{formatTsh(t.monthly_rent)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}