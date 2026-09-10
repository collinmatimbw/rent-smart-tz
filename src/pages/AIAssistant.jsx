import React, { useEffect, useState, useRef } from "react";
import { mysql } from "@/api/mysqlClient";
import { formatTsh } from "@/lib/format";
import { Sparkles, Send, Loader2 } from "lucide-react";

const SUGGESTIONS = [
  "Who hasn't paid rent this month?",
  "Which property has the highest outstanding balance?",
  "How many units are vacant?",
  "Which tenants have contracts expiring soon?",
  "What's my net profit this month?",
  "List all tenants with outstanding balances",
];

function generateAnswer(question, data) {
  const q = question.toLowerCase();
  const { properties, units, tenants, payments, expenses, maintenance, utilities, currentMonth } = data;
  const now = new Date();

  const occupied = units.filter((u) => u.status === "Occupied").length;
  const vacant = units.filter((u) => u.status === "Vacant").length;
  const totalExpected = tenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
  const totalOutstanding = tenants.reduce((s, t) => s + (t.balance || 0), 0);
  const monthlyCollected = payments.filter((p) => p.period === currentMonth && p.status === "Completed").reduce((s, p) => s + (p.amount || 0), 0);
  const monthlyExpenses = expenses.filter((e) => e.date && e.date.slice(0, 7) === currentMonth).reduce((s, e) => s + (e.amount || 0), 0);
  const paidTenantIds = new Set(payments.filter((p) => p.period === currentMonth && p.status === "Completed").map((p) => p.tenant_id));
  const unpaidTenants = tenants.filter((t) => !paidTenantIds.has(t.id));
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring = tenants.filter((t) => t.lease_end && new Date(t.lease_end) >= now && new Date(t.lease_end) <= thirtyDaysFromNow);
  const openMaintenance = maintenance.filter((m) => m.status === "Open" || m.status === "In Progress");

  if (q.includes("hasn't paid") || q.includes("unpaid") || q.includes("who didn't pay") || q.includes("who has not paid")) {
    if (unpaidTenants.length === 0) return `All ${tenants.length} active tenants have paid rent for ${currentMonth}. Great job!`;
    const list = unpaidTenants.slice(0, 10).map((t) => `• ${t.full_name} — ${formatTsh(t.monthly_rent)}/mo (balance: ${formatTsh(t.balance || 0)})`).join("\n");
    return `${unpaidTenants.length} tenant(s) haven't paid for ${currentMonth}:\n\n${list}${unpaidTenants.length > 10 ? `\n...and ${unpaidTenants.length - 10} more` : ""}`;
  }

  if (q.includes("highest outstanding") || q.includes("most outstanding") || q.includes("biggest balance")) {
    const byProperty = properties.map((p) => {
      const propTenants = tenants.filter((t) => t.property_id === p.id);
      const outstanding = propTenants.reduce((s, t) => s + (t.balance || 0), 0);
      return { name: p.name, outstanding, count: propTenants.length };
    }).filter((p) => p.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    if (byProperty.length === 0) return "No outstanding balances across any property.";
    const top = byProperty[0];
    return `${top.name} has the highest outstanding balance at ${formatTsh(top.outstanding)} across ${top.count} tenant(s).\n\nAll properties with outstanding balances:\n${byProperty.map((p) => `• ${p.name}: ${formatTsh(p.outstanding)}`).join("\n")}`;
  }

  if (q.includes("vacant") || q.includes("empty") || q.includes("available")) {
    const vacantList = units.filter((u) => u.status === "Vacant");
    if (vacantList.length === 0) return `No vacant units. All ${occupied} units are occupied.`;
    const byProperty = {};
    vacantList.forEach((u) => {
      const pName = properties.find((p) => p.id === u.property_id)?.name || "Unknown";
      if (!byProperty[pName]) byProperty[pName] = [];
      byProperty[pName].push(u);
    });
    let result = `${vacantList.length} vacant unit(s) out of ${units.length} total:\n\n`;
    for (const [propName, unitsList] of Object.entries(byProperty)) {
      result += `${propName}:\n${unitsList.map((u) => `  • Unit ${u.unit_number} (${u.type}) — ${formatTsh(u.rent_amount)}/mo`).join("\n")}\n`;
    }
    return result;
  }

  if (q.includes("expiring") || q.includes("contract end") || q.includes("lease end")) {
    if (expiring.length === 0) return "No contracts expiring in the next 30 days.";
    const list = expiring.map((t) => `• ${t.full_name} — expires ${t.lease_end} (rent: ${formatTsh(t.monthly_rent)})`).join("\n");
    return `${expiring.length} contract(s) expiring within 30 days:\n\n${list}\n\nConsider reaching out to these tenants about renewals.`;
  }

  if (q.includes("net profit") || q.includes("profit") || q.includes("income")) {
    const profit = monthlyCollected - monthlyExpenses;
    return `Financial summary for ${currentMonth}:\n\n• Expected rent: ${formatTsh(totalExpected)}\n• Collected: ${formatTsh(monthlyCollected)}\n• Expenses: ${formatTsh(monthlyExpenses)}\n• Net profit: ${formatTsh(profit)}\n\nCollection rate: ${totalExpected > 0 ? Math.round((monthlyCollected / totalExpected) * 100) : 0}%`;
  }

  if (q.includes("outstanding") || q.includes("balance")) {
    const withBalance = tenants.filter((t) => (t.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0));
    if (withBalance.length === 0) return "No tenants have outstanding balances. All accounts are settled!";
    const list = withBalance.slice(0, 15).map((t) => `• ${t.full_name}: ${formatTsh(t.balance)} (rent: ${formatTsh(t.monthly_rent)})`).join("\n");
    return `${withBalance.length} tenant(s) with outstanding balances (total: ${formatTsh(totalOutstanding)}):\n\n${list}${withBalance.length > 15 ? `\n...and ${withBalance.length - 15} more` : ""}`;
  }

  if (q.includes("maintenance") || q.includes("repair")) {
    const open = maintenance.filter((m) => m.status === "Open").length;
    const inProgress = maintenance.filter((m) => m.status === "In Progress").length;
    const resolved = maintenance.filter((m) => m.status === "Resolved").length;
    return `Maintenance overview:\n\n• Open requests: ${open}\n• In Progress: ${inProgress}\n• Resolved: ${resolved}\n• Total: ${maintenance.length}`;
  }

  if (q.includes("collection") || q.includes("collected") || q.includes("rent collected")) {
    const rate = totalExpected > 0 ? Math.round((monthlyCollected / totalExpected) * 100) : 0;
    return `Collection summary for ${currentMonth}:\n\n• Expected: ${formatTsh(totalExpected)}\n• Collected: ${formatTsh(monthlyCollected)}\n• Collection rate: ${rate}%\n• ${tenants.length - unpaidTenants.length} of ${tenants.length} tenants paid`;
  }

  if (q.includes("summary") || q.includes("overview") || q.includes("portfolio")) {
    return `Portfolio Overview:\n\n• ${properties.length} properties\n• ${units.length} units (${occupied} occupied, ${vacant} vacant)\n• ${tenants.length} active tenants\n• Expected monthly rent: ${formatTsh(totalExpected)}\n• Collected this month: ${formatTsh(monthlyCollected)}\n• Outstanding balance: ${formatTsh(totalOutstanding)}\n• Monthly expenses: ${formatTsh(monthlyExpenses)}\n• Open maintenance: ${openMaintenance.length}`;
  }

  if (q.includes("expense") || q.includes("spending") || q.includes("cost")) {
    const byCategory = {};
    expenses.forEach((e) => {
      const cat = e.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat] += e.amount || 0;
    });
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const list = sorted.map(([cat, amt]) => `• ${cat}: ${formatTsh(amt)}`).join("\n");
    return `Expense summary for ${currentMonth}:\n\nTotal: ${formatTsh(monthlyExpenses)}\n\nBy category:\n${list || "No expenses recorded."}`;
  }

  if (q.includes("property") && (q.includes("list") || q.includes("all") || q.includes("how many"))) {
    const details = properties.map((p) => {
      const pUnits = units.filter((u) => u.property_id === p.id);
      const pTenants = tenants.filter((t) => t.property_id === p.id);
      const pRent = pUnits.reduce((s, u) => s + (u.rent_amount || 0), 0);
      return `• ${p.name} (${p.type})\n  Address: ${p.address || "—"}\n  Units: ${pUnits.length} | Tenants: ${pTenants.length} | Rent: ${formatTsh(pRent)}/mo`;
    }).join("\n\n");
    return `${properties.length} properties:\n\n${details}`;
  }

  return `I can help with questions about:\n\n• Who hasn't paid rent\n• Outstanding balances\n• Vacant units\n• Contract expirations\n• Net profit and financials\n• Collection rates\n• Maintenance status\n• Property details\n• Expense breakdowns\n\nTry asking something specific about your portfolio!`;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function loadContext() {
    try {
      const [properties, units, tenants, payments, expenses, maintenance, utilities] = await Promise.all([
        mysql.entities.Property.list("-created_date", 500),
        mysql.entities.Unit.list("-created_date", 500),
        mysql.entities.Tenant.filter({ status: "Active" }, "-created_date", 500),
        mysql.entities.Payment.list("-created_date", 500),
        mysql.entities.Expense.list("-date", 500),
        mysql.entities.MaintenanceRequest.list("-reported_date", 500),
        mysql.entities.Utility.list("-reading_date", 500),
      ]);

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      setContext({ properties, units, tenants, payments, expenses, maintenance, utilities, currentMonth });
    } finally {
      setLoadingContext(false);
    }
  }

  async function ask(question) {
    if (!question.trim() || loading || !context) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const answer = generateAnswer(question, context);
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-500" /> AI Assistant
        </h1>
        <p className="text-sm text-slate-500 mt-1">Ask questions about your property portfolio</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-indigo-500" />
              </div>
              <p className="text-sm text-slate-600 mt-4 font-medium">Ask me anything about your portfolio</p>
              <p className="text-xs text-slate-400 mt-1">I analyze your data and provide instant insights</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-500">Analyzing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {!loadingContext && (
          <div className="px-5 pb-3">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} disabled={loading} className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-100 p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={loadingContext ? "Loading portfolio data..." : "Ask a question..."}
              disabled={loading || loadingContext}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:opacity-50"
            />
            <button type="submit" disabled={loading || loadingContext || !input.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
