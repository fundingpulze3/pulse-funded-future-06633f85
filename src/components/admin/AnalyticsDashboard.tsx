import { useMemo, useState } from "react";
import {
  Eye, Globe, Clock, MousePointer, ExternalLink, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface AnalyticsDashboardProps {
  pageVisits: any[];
  profiles: any[];
}

type DateRange = "7d" | "30d" | "90d";

const PIE_COLORS = [
  "hsl(0,0%,10%)", "hsl(0,0%,30%)", "hsl(0,0%,45%)", "hsl(0,0%,60%)", "hsl(0,0%,75%)", "hsl(0,0%,88%)",
];

export default function AnalyticsDashboard({ pageVisits, profiles }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
  const now = Date.now();
  const cutoff = now - days * 86400000;

  const filtered = useMemo(() =>
    pageVisits.filter(v =>
      !v.page_url?.includes("lovable") &&
      !v.referrer?.includes("lovable") &&
      new Date(v.created_at).getTime() >= cutoff
    ), [pageVisits, cutoff]);

  // Visits over time
  const visitsTimeline = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      buckets[d.toISOString().slice(5, 10)] = 0;
    }
    filtered.forEach(v => {
      const key = v.created_at?.slice(5, 10);
      if (key && buckets[key] !== undefined) buckets[key]++;
    });
    return Object.entries(buckets).map(([date, visits]) => ({ date, visits }));
  }, [filtered, days]);

  // Unique sessions
  const uniqueSessions = useMemo(() => new Set(filtered.map(v => v.session_id)).size, [filtered]);

  // Bounce rate (single-page sessions)
  const bounceRate = useMemo(() => {
    const sessionPages: Record<string, number> = {};
    filtered.forEach(v => {
      sessionPages[v.session_id] = (sessionPages[v.session_id] || 0) + 1;
    });
    const total = Object.keys(sessionPages).length;
    const bounced = Object.values(sessionPages).filter(c => c === 1).length;
    return total > 0 ? ((bounced / total) * 100).toFixed(1) : "0";
  }, [filtered]);

  // Avg pages per session
  const avgPagesPerSession = useMemo(() => {
    const sessions = new Set(filtered.map(v => v.session_id)).size;
    return sessions > 0 ? (filtered.length / sessions).toFixed(1) : "0";
  }, [filtered]);

  // Top pages
  const topPages = useMemo(() => {
    const pages: Record<string, number> = {};
    filtered.forEach(v => { pages[v.page_url] = (pages[v.page_url] || 0) + 1; });
    return Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  // Top referrers
  const topReferrers = useMemo(() => {
    const refs: Record<string, number> = {};
    filtered.filter(v => v.referrer).forEach(v => {
      try {
        const host = new URL(v.referrer).hostname.replace("www.", "");
        if (!host.includes("lovable")) refs[host] = (refs[host] || 0) + 1;
      } catch {}
    });
    return Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  // UTM source distribution
  const utmPie = useMemo(() => {
    const sources: Record<string, number> = {};
    filtered.forEach(v => {
      if (v.utm_source) sources[v.utm_source] = (sources[v.utm_source] || 0) + 1;
    });
    return Object.entries(sources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const ranges: { key: DateRange; label: string }[] = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" },
  ];

  const statCards = [
    { label: "Total Visits", value: filtered.length.toLocaleString(), icon: <Eye size={16} /> },
    { label: "Unique Sessions", value: uniqueSessions.toLocaleString(), icon: <MousePointer size={16} /> },
    { label: "Bounce Rate", value: `${bounceRate}%`, icon: <Clock size={16} /> },
    { label: "Pages / Session", value: avgPagesPerSession, icon: <BarChart3 size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex items-center gap-1 bg-[hsl(0,0%,100%)] rounded-lg border border-[hsl(0,0%,90%)] p-1 w-fit">
        {ranges.map(r => (
          <button key={r.key} onClick={() => setDateRange(r.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateRange === r.key ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,15%)]"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(c => (
          <div key={c.label} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">{c.label}</span>
              <span className="text-[hsl(0,0%,60%)]">{c.icon}</span>
            </div>
            <p className="text-xl font-display font-bold text-[hsl(0,0%,5%)]">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Visits Timeline */}
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-[hsl(0,0%,40%)]" />
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Visits Over Time</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={visitsTimeline}>
            <defs>
              <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0,0%,0%)" stopOpacity={0.08} />
                <stop offset="95%" stopColor="hsl(0,0%,0%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
            <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
            <Area type="monotone" dataKey="visits" stroke="hsl(0,0%,0%)" strokeWidth={2} fill="url(#visitGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row: Top Pages + Referrers + UTM Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Pages */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(0,0%,93%)] flex items-center gap-2">
            <Eye size={15} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Top Pages</h3>
          </div>
          <div className="max-h-[350px] overflow-auto">
            {topPages.map(([page, count], i) => (
              <div key={page} className="flex items-center justify-between px-5 py-2.5 border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-[hsl(0,0%,55%)] w-5">{i + 1}</span>
                  <span className="text-xs font-mono text-[hsl(0,0%,25%)] truncate">{page}</span>
                </div>
                <span className="text-xs font-mono text-[hsl(0,0%,50%)] shrink-0 ml-2">{count}</span>
              </div>
            ))}
            {topPages.length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-8">No data</p>}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(0,0%,93%)] flex items-center gap-2">
            <ExternalLink size={15} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Top Referrers</h3>
          </div>
          <div className="max-h-[350px] overflow-auto">
            {topReferrers.map(([ref, count], i) => (
              <div key={ref} className="flex items-center justify-between px-5 py-2.5 border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-[hsl(0,0%,55%)] w-5">{i + 1}</span>
                  <span className="text-xs text-[hsl(0,0%,25%)] truncate">{ref}</span>
                </div>
                <span className="text-xs font-mono text-[hsl(0,0%,50%)] shrink-0 ml-2">{count}</span>
              </div>
            ))}
            {topReferrers.length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-8">No data</p>}
          </div>
        </div>

        {/* UTM Source Distribution */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={15} className="text-[hsl(0,0%,40%)]" />
            <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">UTM Sources</h3>
          </div>
          {utmPie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={utmPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} strokeWidth={0}>
                    {utmPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {utmPie.map((s, i) => (
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
            <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">No UTM data</p>
          )}
        </div>
      </div>
    </div>
  );
}
