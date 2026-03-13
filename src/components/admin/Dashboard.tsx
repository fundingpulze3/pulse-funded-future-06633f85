import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, Users, ShoppingCart, TrendingUp, BarChart3, Percent,
  Trophy, Clock, MessageSquare, ArrowUpRight, ArrowDownRight, Activity,
  Eye, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

interface DashboardProps {
  profiles: any[];
  purchases: any[];
  referrals: any[];
  challenges: any[];
  pageVisits: any[];
  getProfileName: (userId: string) => string;
  getChallengeNameById: (id: string) => string;
}

type DateRange = "today" | "7d" | "30d" | "90d" | "all";

const PIE_COLORS = [
  "hsl(0,0%,15%)", "hsl(0,0%,35%)", "hsl(0,0%,55%)", "hsl(0,0%,70%)", "hsl(0,0%,85%)",
];

export default function Dashboard({
  profiles, purchases, referrals, challenges, pageVisits,
  getProfileName, getChallengeNameById,
}: DashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("help_support_tickets").select("id, created_at, status").then(({ data }) => {
      if (data) setTickets(data);
    });
  }, []);

  const rangeMs: Record<DateRange, number> = {
    today: 86400000,
    "7d": 7 * 86400000,
    "30d": 30 * 86400000,
    "90d": 90 * 86400000,
    all: Date.now(),
  };

  const now = Date.now();
  const cutoff = now - rangeMs[dateRange];
  const prevCutoff = cutoff - rangeMs[dateRange];

  const inRange = (d: string) => new Date(d).getTime() >= cutoff;
  const inPrevRange = (d: string) => {
    const t = new Date(d).getTime();
    return t >= prevCutoff && t < cutoff;
  };

  const filteredVisits = useMemo(() =>
    pageVisits.filter(v => !v.page_url?.includes("lovable") && !v.referrer?.includes("lovable")),
    [pageVisits]
  );

  const isCountablePurchase = (purchase: any) => {
    const paymentStatus = String(purchase?.payment_status || "").toLowerCase();
    const orderStatus = String(purchase?.status || "").toLowerCase();
    return ["paid", "confirmed", "completed"].includes(paymentStatus) && orderStatus !== "pending";
  };

  const rangedPurchases = useMemo(() => purchases.filter(p => inRange(p.created_at) && isCountablePurchase(p)), [purchases, dateRange]);
  const prevPurchases = useMemo(() => purchases.filter(p => inPrevRange(p.created_at) && isCountablePurchase(p)), [purchases, dateRange]);
  const rangedProfiles = useMemo(() => profiles.filter(p => inRange(p.created_at)), [profiles, dateRange]);
  const prevProfiles = useMemo(() => profiles.filter(p => inPrevRange(p.created_at)), [profiles, dateRange]);
  const rangedVisits = useMemo(() => filteredVisits.filter(v => inRange(v.created_at)), [filteredVisits, dateRange]);
  const prevVisits = useMemo(() => filteredVisits.filter(v => inPrevRange(v.created_at)), [filteredVisits, dateRange]);

  const totalRevenue = rangedPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const prevRevenue = prevPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const totalOrders = rangedPurchases.length;
  const prevOrders = prevPurchases.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const prevAvg = prevOrders > 0 ? prevRevenue / prevOrders : 0;
  const conversionRate = rangedProfiles.length > 0 ? (rangedPurchases.length / rangedProfiles.length) * 100 : 0;
  const prevConvRate = prevProfiles.length > 0 ? (prevPurchases.length / prevProfiles.length) * 100 : 0;
  const totalPayouts = referrals.filter(r => r.commission_status === "paid" && inRange(r.created_at)).reduce((s, r) => s + (r.commission_amount || 0), 0);
  const prevPayouts = referrals.filter(r => r.commission_status === "paid" && inPrevRange(r.created_at)).reduce((s, r) => s + (r.commission_amount || 0), 0);
  const activeTickets = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
  const activeChallenges = challenges.filter(c => c.is_active).length;

  const pctChange = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  const statCards = [
    { label: "Revenue", value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <DollarSign size={16} />, change: pctChange(totalRevenue, prevRevenue) },
    { label: "Users", value: rangedProfiles.length.toLocaleString(), icon: <Users size={16} />, change: pctChange(rangedProfiles.length, prevProfiles.length) },
    { label: "Orders", value: totalOrders.toLocaleString(), icon: <ShoppingCart size={16} />, change: pctChange(totalOrders, prevOrders) },
    { label: "Avg Order", value: `$${avgOrderValue.toFixed(0)}`, icon: <TrendingUp size={16} />, change: pctChange(avgOrderValue, prevAvg) },
    { label: "Conversion", value: `${conversionRate.toFixed(1)}%`, icon: <Percent size={16} />, change: pctChange(conversionRate, prevConvRate) },
    { label: "Payouts", value: `$${totalPayouts.toFixed(2)}`, icon: <BarChart3 size={16} />, change: pctChange(totalPayouts, prevPayouts) },
    { label: "Open Tickets", value: activeTickets.toLocaleString(), icon: <MessageSquare size={16} />, change: 0 },
    { label: "Active Challenges", value: activeChallenges.toLocaleString(), icon: <Trophy size={16} />, change: 0 },
  ];

  // Revenue chart data
  const days = dateRange === "today" ? 1 : dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
  const chartData = useMemo(() => {
    const buckets: Record<string, { revenue: number; payouts: number; users: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(5, 10);
      buckets[key] = { revenue: 0, payouts: 0, users: 0 };
    }
    rangedPurchases.forEach(p => {
      const key = p.created_at?.slice(5, 10);
      if (key && buckets[key]) buckets[key].revenue += p.amount_paid || 0;
    });
    referrals.filter(r => r.commission_status === "paid" && inRange(r.created_at)).forEach(r => {
      const key = r.created_at?.slice(5, 10);
      if (key && buckets[key]) buckets[key].payouts += r.commission_amount || 0;
    });
    rangedProfiles.forEach(p => {
      const key = p.created_at?.slice(5, 10);
      if (key && buckets[key]) buckets[key].users++;
    });
    return Object.entries(buckets).map(([date, vals]) => ({ date, ...vals }));
  }, [rangedPurchases, referrals, rangedProfiles, dateRange]);

  // User growth cumulative
  const userGrowthData = useMemo(() => {
    let cumulative = profiles.filter(p => new Date(p.created_at).getTime() < cutoff).length;
    return chartData.map(d => {
      cumulative += d.users;
      return { date: d.date, total: cumulative };
    });
  }, [chartData, profiles, cutoff]);

  // Traffic sources pie
  const trafficPie = useMemo(() => {
    const sources: Record<string, number> = {};
    rangedVisits.forEach(v => {
      const src = v.utm_source || (v.referrer ? new URL(v.referrer).hostname.replace("www.", "") : "Direct");
      sources[src] = (sources[src] || 0) + 1;
    });
    return Object.entries(sources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [rangedVisits]);

  // Conversion funnel
  const funnelData = useMemo(() => [
    { stage: "Visits", value: rangedVisits.length },
    { stage: "Signups", value: rangedProfiles.length },
    { stage: "Purchases", value: rangedPurchases.length },
  ], [rangedVisits, rangedProfiles, rangedPurchases]);

  // Activity feed
  const activityFeed = useMemo(() => {
    const events: { type: string; label: string; time: string; icon: string }[] = [];
    rangedProfiles.slice(0, 20).forEach(p => {
      events.push({ type: "signup", label: `${p.display_name || p.email || "User"} signed up`, time: p.created_at, icon: "user" });
    });
    rangedPurchases.slice(0, 20).forEach(p => {
      events.push({ type: "purchase", label: `${getProfileName(p.user_id)} purchased ${getChallengeNameById(p.challenge_id)}`, time: p.created_at, icon: "cart" });
    });
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15);
  }, [rangedProfiles, rangedPurchases, getProfileName, getChallengeNameById]);

  // Top pages
  const topPages = useMemo(() => {
    const pages: Record<string, number> = {};
    rangedVisits.forEach(v => {
      pages[v.page_url] = (pages[v.page_url] || 0) + 1;
    });
    return Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [rangedVisits]);

  // Top referrers
  const topReferrers = useMemo(() => {
    const refs: Record<string, number> = {};
    rangedVisits.filter(v => v.referrer).forEach(v => {
      try {
        const host = new URL(v.referrer).hostname.replace("www.", "");
        if (!host.includes("lovable")) refs[host] = (refs[host] || 0) + 1;
      } catch {}
    });
    return Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rangedVisits]);

  const ranges: { key: DateRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex items-center gap-1 bg-[hsl(0,0%,100%)] rounded-lg border border-[hsl(0,0%,90%)] p-1 w-fit">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={() => setDateRange(r.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              dateRange === r.key
                ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]"
                : "text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,15%)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">{card.label}</span>
              <span className="text-[hsl(0,0%,60%)]">{card.icon}</span>
            </div>
            <p className="text-xl font-display font-bold text-[hsl(0,0%,5%)]">{card.value}</p>
            {card.change !== 0 && (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-medium ${card.change > 0 ? "text-[hsl(142,60%,40%)]" : "text-[hsl(0,70%,50%)]"}`}>
                {card.change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{Math.abs(card.change).toFixed(1)}%</span>
                <span className="text-[hsl(0,0%,55%)] font-normal">vs prev</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Revenue & Payouts</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0,0%,0%)" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="hsl(0,0%,0%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} formatter={(v: number) => [`$${v.toFixed(2)}`, ""]} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(0,0%,0%)" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              <Area type="monotone" dataKey="payouts" stroke="hsl(0,0%,60%)" strokeWidth={1.5} fill="none" name="Payouts" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Traffic Sources Pie */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Traffic Sources</h3>
          </div>
          {trafficPie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={trafficPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} strokeWidth={0}>
                    {trafficPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {trafficPie.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[hsl(0,0%,30%)]">{s.name}</span>
                    </div>
                    <span className="font-mono text-[hsl(0,0%,50%)]">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-xs text-[hsl(0,0%,55%)] py-12">No traffic data</p>
          )}
        </div>
      </div>

      {/* Row 2: User Growth + Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Growth */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">User Growth</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} />
              <Line type="monotone" dataKey="total" stroke="hsl(0,0%,0%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Conversion Funnel</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: "hsl(0,0%,30%)" }} axisLine={false} tickLine={false} width={70} />
              <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} />
              <Bar dataKey="value" fill="hsl(0,0%,15%)" radius={[0, 4, 4, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Activity Feed + Top Pages + Top Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5 max-h-[400px] overflow-auto">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Activity Feed</h3>
          </div>
          {activityFeed.length === 0 ? (
            <p className="text-xs text-[hsl(0,0%,55%)] text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-0">
              {activityFeed.map((e, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[hsl(0,0%,95%)] last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    e.type === "purchase" ? "bg-[hsl(0,0%,0%)]" : "bg-[hsl(0,0%,90%)]"
                  }`}>
                    {e.type === "purchase"
                      ? <ShoppingCart size={11} className="text-[hsl(0,0%,100%)]" />
                      : <Users size={11} className="text-[hsl(0,0%,40%)]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[hsl(0,0%,20%)] leading-tight truncate">{e.label}</p>
                    <p className="text-[10px] text-[hsl(0,0%,55%)] mt-0.5">{new Date(e.time).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Pages */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5 max-h-[400px] overflow-auto">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Top Pages</h3>
          </div>
          <div className="space-y-0">
            {topPages.map(([page, count], i) => (
              <div key={page} className="flex items-center justify-between py-2 border-b border-[hsl(0,0%,95%)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-[hsl(0,0%,55%)] w-4">{i + 1}</span>
                  <span className="text-xs font-mono text-[hsl(0,0%,25%)] truncate">{page}</span>
                </div>
                <span className="text-xs font-mono text-[hsl(0,0%,50%)] shrink-0 ml-2">{count}</span>
              </div>
            ))}
            {topPages.length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-6">No data</p>}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5 max-h-[400px] overflow-auto">
          <div className="flex items-center gap-2 mb-4">
            <ExternalLink size={16} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Top Referrers</h3>
          </div>
          <div className="space-y-0">
            {topReferrers.map(([ref, count], i) => (
              <div key={ref} className="flex items-center justify-between py-2 border-b border-[hsl(0,0%,95%)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-[hsl(0,0%,55%)] w-4">{i + 1}</span>
                  <span className="text-xs text-[hsl(0,0%,25%)] truncate">{ref}</span>
                </div>
                <span className="text-xs font-mono text-[hsl(0,0%,50%)] shrink-0 ml-2">{count}</span>
              </div>
            ))}
            {topReferrers.length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-6">No referrer data</p>}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart size={16} className="text-[hsl(0,0%,40%)]" />
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Recent Sales</h3>
        </div>
        <div className="space-y-0">
          {rangedPurchases.length === 0 && <p className="text-center text-xs text-[hsl(0,0%,55%)] py-6">No sales in this period</p>}
          {rangedPurchases.slice(0, 10).map(sale => (
            <div key={sale.id} className="flex items-center justify-between py-3 border-b border-[hsl(0,0%,95%)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[hsl(0,0%,94%)] flex items-center justify-center">
                  <ShoppingCart size={13} className="text-[hsl(0,0%,50%)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{getProfileName(sale.user_id)}</p>
                  <p className="text-[10px] text-[hsl(0,0%,50%)]">{getChallengeNameById(sale.challenge_id)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[hsl(0,0%,5%)]">${sale.amount_paid}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  sale.payment_status === "confirmed" ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,30%)]" : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,55%)]"
                }`}>{sale.payment_status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
