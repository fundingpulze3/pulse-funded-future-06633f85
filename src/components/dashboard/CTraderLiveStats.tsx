import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
}

const CTraderLiveStats = ({ credentialId }: { credentialId: string }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const load = async () => {
      const { data } = await supabase
        .from("ctrader_snapshots")
        .select("id, captured_at, balance, equity, margin_used, roi_percent, open_positions_count")
        .eq("credential_id", credentialId)
        .gte("captured_at", since)
        .order("captured_at", { ascending: true });
      if (!mounted) return;
      setSnapshots((data as Snapshot[]) ?? []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`ctrader_snapshots_${credentialId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ctrader_snapshots", filter: `credential_id=eq.${credentialId}` },
        (payload) => setSnapshots((prev) => [...prev, payload.new as Snapshot])
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [credentialId]);

  const latest = snapshots[snapshots.length - 1];

  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        date: new Date(s.captured_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        equity: Number(s.equity ?? 0),
      })),
    [snapshots]
  );

  if (loading) {
    return <div className="w-full h-[360px] rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] animate-pulse" />;
  }

  if (!latest) {
    return (
      <div className="w-full rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] p-10 text-center">
        <p className="text-sm text-[hsl(220,15%,45%)]">
          Connected. Waiting for the first data sync — this usually takes a few minutes.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Equity", value: `$${Number(latest.equity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
    { label: "Balance", value: `$${Number(latest.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
    { label: "ROI", value: `${Number(latest.roi_percent ?? 0).toFixed(2)}%` },
    { label: "Open Positions", value: String(latest.open_positions_count ?? 0) },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3">
            <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-1">{c.label}</p>
            <p className="text-base font-bold font-display">{c.value}</p>
          </div>
        ))}
      </div>

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
