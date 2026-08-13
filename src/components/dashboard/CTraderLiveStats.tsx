import { useEffect, useMemo, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

interface Snapshot {
  id: string;
  captured_at: string;
  balance: number | null;
  equity: number | null;
  margin_used: number | null;
  roi_percent: number | null;
  open_positions_count: number | null;
  profit: number | null;
  deposits: number | null;
  win_rate: number | null;
  total_trades: number | null;
  winning_trades: number | null;
  losing_trades: number | null;
  profit_factor: number | null;
  max_drawdown_percent: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  best_trade: number | null;
  worst_trade: number | null;
  currency: string | null;
  account_name: string | null;
  period: string | null;
}

interface SyncState {
  last_sync_at: string | null;
  last_success_at: string | null;
  last_status: string;
  last_error: string | null;
  consecutive_failures: number;
}

const SNAPSHOT_COLUMNS =
  "id, captured_at, balance, equity, margin_used, roi_percent, open_positions_count, profit, deposits, win_rate, total_trades, winning_trades, losing_trades, profit_factor, max_drawdown_percent, avg_win, avg_loss, best_trade, worst_trade, currency, account_name, period";

const CTraderLiveStats = ({ credentialId }: { credentialId: string }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const load = async () => {
      const [snapRes, syncRes] = await Promise.all([
        supabase
          .from("ctrader_snapshots")
          .select(SNAPSHOT_COLUMNS)
          .eq("credential_id", credentialId)
          .gte("captured_at", since)
          .order("captured_at", { ascending: true }),
        supabase
          .from("ctrader_sync_state")
          .select("last_sync_at, last_success_at, last_status, last_error, consecutive_failures")
          .eq("credential_id", credentialId)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      setSnapshots((snapRes.data as unknown as Snapshot[]) ?? []);
      setSync((syncRes.data as unknown as SyncState) ?? null);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`ctrader_live_${credentialId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ctrader_snapshots", filter: `credential_id=eq.${credentialId}` },
        (payload) => setSnapshots((prev) => [...prev, payload.new as unknown as Snapshot])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ctrader_sync_state", filter: `credential_id=eq.${credentialId}` },
        (payload) => setSync(payload.new as unknown as SyncState)
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [credentialId]);

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];

  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        date: new Date(s.captured_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        equity: Number(s.equity ?? s.balance ?? 0),
        balance: Number(s.balance ?? 0),
      })),
    [snapshots]
  );

  const ccy = latest?.currency || "USD";
  const money = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "—";
    const sym = ccy === "USD" ? "$" : ccy === "EUR" ? "€" : ccy === "GBP" ? "£" : ccy === "INR" ? "₹" : "";
    return `${v < 0 ? "-" : ""}${sym}${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : `${v.toFixed(2)}%`;
  const plain = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const relTime = (iso: string | null) => {
    if (!iso) return "never";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.round(hrs / 24)} d ago`;
  };

  if (loading) {
    return <div className="w-full h-[360px] rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] animate-pulse" />;
  }

  const statusBar = (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${
          sync?.last_status === "ok"
            ? "border-[hsl(150,60%,25%)] bg-[hsl(150,60%,10%)] text-[hsl(150,70%,60%)]"
            : sync?.last_status === "error"
            ? "border-[hsl(0,60%,30%)] bg-[hsl(0,60%,10%)] text-[hsl(0,70%,65%)]"
            : "border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[hsl(220,15%,55%)]"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {sync?.last_status === "ok" ? "Syncing" : sync?.last_status === "error" ? "Sync issue" : "Awaiting first sync"}
      </span>
      <span className="text-[hsl(220,15%,40%)]">Updated {relTime(sync?.last_success_at ?? null)}</span>
      {sync?.last_status === "error" && sync.last_error && (
        <span className="text-[hsl(0,70%,60%)] truncate max-w-full">{sync.last_error}</span>
      )}
    </div>
  );

  if (!latest) {
    return (
      <div className="space-y-3">
        {statusBar}
        <div className="w-full rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] p-10 text-center">
          <p className="text-sm text-[hsl(220,15%,45%)]">
            {sync?.last_status === "error"
              ? "Could not read this account's stats yet — see the message above. The full stats panel below still works."
              : "Connected. Waiting for the first data sync — this usually takes a few minutes."}
          </p>
        </div>
      </div>
    );
  }

  const growth =
    first && latest && Number(first.equity ?? first.balance ?? 0) > 0
      ? ((Number(latest.equity ?? latest.balance ?? 0) - Number(first.equity ?? first.balance ?? 0)) /
          Number(first.equity ?? first.balance ?? 0)) *
        100
      : null;

  const primary = [
    { label: "Equity", value: money(latest.equity) },
    { label: "Balance", value: money(latest.balance) },
    { label: "Profit", value: money(latest.profit), tone: (latest.profit ?? 0) >= 0 ? "pos" : "neg" },
    { label: "ROI", value: pct(latest.roi_percent), tone: (latest.roi_percent ?? 0) >= 0 ? "pos" : "neg" },
  ];

  const secondary = [
    { label: "Win Rate", value: pct(latest.win_rate) },
    { label: "Profit Factor", value: plain(latest.profit_factor) },
    { label: "Max Drawdown", value: pct(latest.max_drawdown_percent) },
    { label: "Total Trades", value: plain(latest.total_trades) },
    { label: "Winning Trades", value: plain(latest.winning_trades) },
    { label: "Losing Trades", value: plain(latest.losing_trades) },
    { label: "Average Win", value: money(latest.avg_win) },
    { label: "Average Loss", value: money(latest.avg_loss) },
    { label: "Best Trade", value: money(latest.best_trade) },
    { label: "Worst Trade", value: money(latest.worst_trade) },
    { label: "Deposits", value: money(latest.deposits) },
    { label: "Margin Used", value: money(latest.margin_used) },
    { label: "Open Positions", value: plain(latest.open_positions_count) },
    { label: "Tracked Growth", value: growth === null ? "—" : pct(growth) },
  ].filter((c) => c.value !== "—");

  return (
    <div className="space-y-3">
      {statusBar}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {primary.map((c) => (
          <div key={c.label} className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3">
            <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-1">{c.label}</p>
            <p
              className={`text-base font-bold font-display ${
                c.tone === "pos"
                  ? "text-[hsl(150,70%,60%)]"
                  : c.tone === "neg"
                  ? "text-[hsl(0,70%,62%)]"
                  : ""
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {secondary.length > 0 && (
        <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-4">
          <h3 className="font-display font-bold text-sm mb-3">Performance Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
            {secondary.map((c) => (
              <div key={c.label}>
                <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-0.5">{c.label}</p>
                <p className="text-sm font-semibold">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-5">
        <h3 className="font-display font-bold text-sm mb-4">Equity Curve</h3>
        <div className="h-[220px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(207,90%,77%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(207,90%,77%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,12%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(220,15%,40%)", fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "hsl(220,15%,40%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(220,20%,8%)", border: "1px solid hsl(220,15%,15%)", borderRadius: "8px", color: "white", fontSize: "12px" }} />
              <Area type="monotone" dataKey="equity" stroke="hsl(207,90%,77%)" strokeWidth={2} fill="url(#ctGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CTraderLiveStats;
