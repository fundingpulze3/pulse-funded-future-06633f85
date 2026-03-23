import { useMemo, useState } from "react";
import {
  DollarSign, TrendingUp, Percent, Tag, Users, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";

interface RevenueAnalyticsProps {
  purchases: any[];
  challenges: any[];
  coupons: any[];
  profiles: any[];
  getProfileName: (userId: string) => string;
  getChallengeNameById: (id: string) => string;
}

const BAR_COLORS = ["hsl(0,0%,10%)", "hsl(0,0%,25%)", "hsl(0,0%,40%)", "hsl(0,0%,55%)", "hsl(0,0%,70%)"];

export default function RevenueAnalytics({ purchases: allPurchases, challenges, coupons, profiles, getProfileName, getChallengeNameById }: RevenueAnalyticsProps) {
  // Only count confirmed/completed orders for revenue
  const purchases = useMemo(() => allPurchases.filter(p => p.payment_status === "completed"), [allPurchases]);
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const thisMonthPurchases = useMemo(() => purchases.filter(p => {
    const d = new Date(p.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }), [purchases]);

  const lastMonthPurchases = useMemo(() => purchases.filter(p => {
    const d = new Date(p.created_at);
    return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
  }), [purchases]);

  const thisRev = thisMonthPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const lastRev = lastMonthPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const revChange = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : thisRev > 0 ? 100 : 0;

  const thisAvg = thisMonthPurchases.length > 0 ? thisRev / thisMonthPurchases.length : 0;
  const lastAvg = lastMonthPurchases.length > 0 ? lastRev / lastMonthPurchases.length : 0;

  // Revenue by challenge
  const revenueByChallenge = useMemo(() => {
    const map: Record<string, number> = {};
    purchases.forEach(p => {
      const name = getChallengeNameById(p.challenge_id);
      map[name] = (map[name] || 0) + (p.amount_paid || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, revenue]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, revenue }));
  }, [purchases, getChallengeNameById]);

  // Monthly revenue trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleString("default", { month: "short" });
      const rev = purchases
        .filter(p => { const pd = new Date(p.created_at); return pd.getMonth() === m && pd.getFullYear() === y; })
        .reduce((s, p) => s + (p.amount_paid || 0), 0);
      months.push({ month: label, revenue: rev });
    }
    return months;
  }, [purchases]);

  // Coupon impact
  const couponStats = useMemo(() => {
    const couponPurchases = purchases.filter(p => p.amount_paid < challenges.find(c => c.id === p.challenge_id)?.price);
    const fullPricePurchases = purchases.length - couponPurchases.length;
    const couponRev = couponPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const fullRev = purchases.reduce((s, p) => s + (p.amount_paid || 0), 0) - couponRev;
    return { couponCount: couponPurchases.length, fullCount: fullPricePurchases, couponRev, fullRev };
  }, [purchases, challenges]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    purchases.forEach(p => {
      if (!map[p.user_id]) map[p.user_id] = { total: 0, count: 0 };
      map[p.user_id].total += p.amount_paid || 0;
      map[p.user_id].count++;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([userId, data]) => ({ name: getProfileName(userId), ...data }));
  }, [purchases, getProfileName]);

  // AOV trend
  const aovTrend = useMemo(() => {
    return monthlyTrend.map(m => {
      const monthPurchases = purchases.filter(p => {
        const d = new Date(p.created_at);
        return d.toLocaleString("default", { month: "short" }) === m.month;
      });
      return { month: m.month, aov: monthPurchases.length > 0 ? m.revenue / monthPurchases.length : 0 };
    });
  }, [monthlyTrend, purchases]);

  const cards = [
    { label: "This Month", value: `$${thisRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, change: revChange, icon: <DollarSign size={16} /> },
    { label: "Last Month", value: `$${lastRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, change: null, icon: <TrendingUp size={16} /> },
    { label: "AOV (This Month)", value: `$${thisAvg.toFixed(0)}`, change: lastAvg > 0 ? ((thisAvg - lastAvg) / lastAvg) * 100 : null, icon: <Percent size={16} /> },
    { label: "Total Orders", value: purchases.length.toLocaleString(), change: null, icon: <Tag size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">{c.label}</span>
              <span className="text-[hsl(0,0%,60%)]">{c.icon}</span>
            </div>
            <p className="text-xl font-display font-bold text-[hsl(0,0%,5%)]">{c.value}</p>
            {c.change !== null && (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-medium ${c.change > 0 ? "text-[hsl(142,60%,40%)]" : c.change < 0 ? "text-[hsl(0,70%,50%)]" : "text-[hsl(0,0%,50%)]"}`}>
                {c.change > 0 ? <ArrowUpRight size={12} /> : c.change < 0 ? <ArrowDownRight size={12} /> : null}
                <span>{Math.abs(c.change).toFixed(1)}% vs last month</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Challenge */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)] mb-4">Revenue by Challenge</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByChallenge}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={30}>
                {revenueByChallenge.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)] mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(0,0%,0%)" strokeWidth={2.5} dot={{ r: 4, fill: "#000" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Coupon Impact + AOV Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coupon Impact */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)] mb-4">Coupon Impact</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-[hsl(0,0%,92%)] rounded-lg p-4 text-center">
              <p className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider mb-1">With Coupon</p>
              <p className="text-lg font-display font-bold text-[hsl(0,0%,10%)]">{couponStats.couponCount}</p>
              <p className="text-xs text-[hsl(0,0%,45%)]">${couponStats.couponRev.toFixed(0)} rev</p>
            </div>
            <div className="border border-[hsl(0,0%,92%)] rounded-lg p-4 text-center">
              <p className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider mb-1">Full Price</p>
              <p className="text-lg font-display font-bold text-[hsl(0,0%,10%)]">{couponStats.fullCount}</p>
              <p className="text-xs text-[hsl(0,0%,45%)]">${couponStats.fullRev.toFixed(0)} rev</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full h-3 bg-[hsl(0,0%,92%)] rounded-full overflow-hidden flex">
              <div className="h-full bg-[hsl(0,0%,15%)] rounded-l-full" style={{ width: `${purchases.length > 0 ? (couponStats.fullCount / purchases.length) * 100 : 0}%` }} />
              <div className="h-full bg-[hsl(0,0%,60%)]" style={{ width: `${purchases.length > 0 ? (couponStats.couponCount / purchases.length) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-[hsl(0,0%,50%)]">
              <span>Full Price {purchases.length > 0 ? ((couponStats.fullCount / purchases.length) * 100).toFixed(0) : 0}%</span>
              <span>Discounted {purchases.length > 0 ? ((couponStats.couponCount / purchases.length) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>
        </div>

        {/* AOV Trend */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)] mb-4">Avg Order Value Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={aovTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#ccc" }} formatter={(v: number) => [`$${v.toFixed(0)}`, "AOV"]} />
              <Line type="monotone" dataKey="aov" stroke="hsl(0,0%,30%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(0,0%,30%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(0,0%,93%)] flex items-center gap-2">
          <Users size={15} className="text-[hsl(0,0%,40%)]" />
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Top Customers</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
              <th className="px-5 py-2.5 font-medium">#</th>
              <th className="px-5 py-2.5 font-medium">Customer</th>
              <th className="px-5 py-2.5 font-medium">Orders</th>
              <th className="px-5 py-2.5 font-medium">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.map((c, i) => (
              <tr key={i} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                <td className="px-5 py-2.5 text-sm text-[hsl(0,0%,55%)]">{i + 1}</td>
                <td className="px-5 py-2.5 text-sm font-medium text-[hsl(0,0%,10%)]">{c.name}</td>
                <td className="px-5 py-2.5 text-sm text-[hsl(0,0%,45%)]">{c.count}</td>
                <td className="px-5 py-2.5 text-sm font-semibold text-[hsl(0,0%,5%)]">${c.total.toFixed(2)}</td>
              </tr>
            ))}
            {topCustomers.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-[hsl(0,0%,60%)]">No customer data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
