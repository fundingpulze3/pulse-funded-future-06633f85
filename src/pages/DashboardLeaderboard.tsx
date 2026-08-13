import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db as supabase } from "@/integrations/db/client";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { Crown, Medal, Loader2, BadgeDollarSign, TrendingUp, Search } from "lucide-react";

const BLUE = "207,90%,77%";
const GREEN = "142,60%,50%";
const RED = "0,70%,58%";
const GOLD = "45,90%,58%";

type Row = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  account_label: string | null;
  account_size: number | null;
  gain_percentage: number | null;
  profit: number | null;
  payout_total: number | null;
  total_trades: number | null;
  win_rate: number | null;
  source: string | null;
};

const pct = (n: number | null | undefined) =>
  `${(n ?? 0) >= 0 ? "+" : ""}${(n ?? 0).toFixed(2)}%`;

const money = (n: number | null | undefined) =>
  `$${Math.round(Number(n ?? 0)).toLocaleString()}`;

const DashboardLeaderboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.title = "Funded Account Leaderboard | Funding Pulze";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) load();
  }, [user, authLoading]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [profRes, lbRes] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle(),
      supabase.from("funded_leaderboard").select("*"),
    ]);
    setProfile((profRes.data as any) ?? null);
    setRows(((lbRes.data as any[]) ?? []) as Row[]);
    setLoading(false);
  };

  const ranked = useMemo(() => {
    const list = [...rows].sort((a, b) => (b.gain_percentage ?? 0) - (a.gain_percentage ?? 0));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(r =>
      (r.display_name || "").toLowerCase().includes(q) ||
      (r.country || "").toLowerCase().includes(q) ||
      (r.account_label || "").toLowerCase().includes(q));
  }, [rows, query]);

  const totals = useMemo(() => ({
    traders: rows.length,
    capital: rows.reduce((s, r) => s + Number(r.account_size ?? 0), 0),
    profit: rows.reduce((s, r) => s + Number(r.profit ?? 0), 0),
  }), [rows]);

  const rankBadge = (i: number) => {
    if (i === 0) return <Crown size={16} className={`text-[hsl(${GOLD})]`} />;
    if (i === 1) return <Medal size={16} className="text-[hsl(220,10%,70%)]" />;
    if (i === 2) return <Medal size={16} className="text-[hsl(25,60%,55%)]" />;
    return <span className="text-xs font-semibold text-[hsl(220,15%,45%)]">{i + 1}</span>;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] flex items-center justify-center">
        <Loader2 className="animate-spin text-[hsl(207,90%,77%)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-white">
      <DashboardSidebar profile={profile} />
      <main className="lg:pl-16">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-[hsl(${GREEN})]/15 flex items-center justify-center`}>
              <BadgeDollarSign size={20} className={`text-[hsl(${GREEN})]`} />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Funded Account Leaderboard</h1>
              <p className="text-xs text-[hsl(220,15%,50%)]">Every funded trader at Funding Pulze, ranked by gain</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Funded traders", value: totals.traders.toLocaleString() },
              { label: "Capital allocated", value: money(totals.capital) },
              { label: "Total profit", value: money(totals.profit) },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] p-4">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)]">{s.label}</p>
                <p className="text-lg font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(220,15%,40%)]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search trader, country or account…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,12%)] text-xs text-white placeholder:text-[hsl(220,15%,35%)] focus:outline-none focus:border-[hsl(207,90%,77%)]"
            />
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(220,15%,12%)] flex items-center gap-2">
              <TrendingUp size={15} className={`text-[hsl(${BLUE})]`} />
              <h3 className="text-sm font-display font-semibold">Top funded traders</h3>
            </div>

            {ranked.length === 0 ? (
              <p className="text-xs text-[hsl(220,15%,50%)] text-center py-12">No funded traders listed yet.</p>
            ) : (
              <div className="divide-y divide-[hsl(220,15%,10%)]">
                {ranked.map((r, i) => {
                  const isMe = !!r.user_id && r.user_id === user?.id;
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-5 py-3 ${isMe ? `bg-[hsl(${BLUE})]/5` : ""}`}>
                      <div className="w-7 flex justify-center">{rankBadge(i)}</div>
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt={r.display_name || "Funded trader"} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[hsl(220,15%,14%)] flex items-center justify-center text-[11px] font-bold">
                          {(r.display_name || "T")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {r.display_name || "Trader"}
                          {isMe && <span className={`ml-2 text-[10px] text-[hsl(${BLUE})]`}>YOU</span>}
                        </p>
                        <p className="text-[10px] text-[hsl(220,15%,45%)] truncate">
                          {[r.country, r.account_label || (r.account_size ? `$${Number(r.account_size).toLocaleString()} funded` : null)]
                            .filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="hidden sm:block text-right w-20">
                        <p className="text-[10px] text-[hsl(220,15%,45%)]">Payouts</p>
                        <p className="text-xs font-semibold">{money(r.payout_total)}</p>
                      </div>
                      <div className="hidden sm:block text-right w-16">
                        <p className="text-[10px] text-[hsl(220,15%,45%)]">Win</p>
                        <p className="text-xs font-semibold">{(r.win_rate ?? 0).toFixed(0)}%</p>
                      </div>
                      <div className="text-right w-24">
                        <p className={`text-sm font-bold ${(r.gain_percentage ?? 0) >= 0 ? `text-[hsl(${GREEN})]` : `text-[hsl(${RED})]`}`}>
                          {pct(r.gain_percentage)}
                        </p>
                        <p className="text-[10px] text-[hsl(220,15%,45%)]">{money(r.profit)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLeaderboard;
