import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db as supabase } from "@/integrations/db/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import CTraderStats from "@/components/CTraderStats";
import { detectCountry, flagEmoji, type DetectedCountry } from "@/lib/country";
import { parseCTraderToken } from "@/lib/ctrader";
import {
  Trophy, Medal, Crown, Loader2, Timer, Users, Flame, TrendingUp, Gift, Ticket, KeyRound,
} from "lucide-react";


const BLUE = "207,90%,77%";
const GREEN = "142,60%,50%";
const RED = "0,70%,58%";
const GOLD = "45,90%,58%";

type Competition = {
  id: string;
  name: string;
  description: string | null;
  prize_text: string | null;
  prize_pool: number | null;
  starts_at: string;
  ends_at: string;
  status: string; // draft | active | ended
};

type Participant = {
  id: string;
  competition_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  purchase_id: string | null;
  account_label: string | null;
  account_size: number | null;
  gain_percentage: number | null;
  profit: number | null;
  total_trades: number | null;
  win_rate: number | null;
  updated_at: string | null;
  country_code?: string | null;
  country_name?: string | null;
  seat_status?: string | null;      // pending | issued
  seat_login?: string | null;
  seat_password?: string | null;
  seat_server?: string | null;
  seat_link?: string | null;        // cTrader investor token / link
};


type MyAccount = {
  purchaseId: string;
  label: string;
  accountSize: number;
  gain: number;
  profit: number;
  totalTrades: number;
  winRate: number;
};

const pct = (n: number | null | undefined) =>
  `${(n ?? 0) >= 0 ? "+" : ""}${(n ?? 0).toFixed(2)}%`;

const timeLeft = (end: string) => {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};

const DashboardCompetitions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myAccounts, setMyAccounts] = useState<MyAccount[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [joinAccount, setJoinAccount] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [country, setCountry] = useState<DetectedCountry | null>(null);

  useEffect(() => { detectCountry().then(setCountry).catch(() => {}); }, []);


  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.title = "Trading Competitions | Funding Pulze";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [profRes, compRes, partRes, purchRes, certRes] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("competitions").select("*").order("starts_at", { ascending: false }),
        supabase.from("competition_participants").select("*"),
        supabase.from("challenge_purchases")
          .select("id, challenge_id, status, challenges(name, account_size)")
          .eq("user_id", user.id)
          .in("payment_status", ["paid", "confirmed", "completed"]),
        supabase.from("user_certificates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      const prof = (profRes.data as any) ?? null;
      setProfile(prof);
      const comps = ((compRes.data as any[]) ?? []).filter(c => c.status !== "draft") as Competition[];
      setCompetitions(comps);
      setParticipants(((partRes.data as any[]) ?? []) as Participant[]);

      // ── Build my accounts + live gain % from latest rich stats ──
      const certs = ((certRes.data as any[]) ?? []);
      const rich = (s: any) => s && typeof s === "object" &&
        (typeof s.balance === "number" || typeof s.equity === "number" || typeof s.profit === "number");

      // Open to everyone — any paid account can enter (pending orders excluded)
      const accounts: MyAccount[] = ((purchRes.data as any[]) ?? [])
        .filter((p: any) => String(p.status || "").toLowerCase() !== "pending")
        .map((p: any) => {
        const size = Number(p.challenges?.account_size || 0);
        const cert = certs.find(c => c.purchase_id === p.id && rich(c.stats));
        const s = cert?.stats || {};
        const balance = Number(s.equity ?? s.balance ?? size);
        const profit = Number(s.profit ?? (balance - size));
        const gain = size > 0 ? (profit / size) * 100 : 0;
        return {
          purchaseId: p.id,
          label: `${p.challenges?.name || "Account"} · $${size.toLocaleString()}`,
          accountSize: size,
          gain: Number.isFinite(gain) ? gain : 0,
          profit: Number.isFinite(profit) ? profit : 0,
          totalTrades: Number(s.totalTrades ?? 0),
          winRate: Number(s.winRate ?? 0),
        };
      });
      setMyAccounts(accounts);

      const firstActive = comps.find(c => c.status === "active") || comps[0];
      setSelectedComp(prev => prev ?? firstActive?.id ?? null);

      // Keep my own entries' stats fresh (only I can read my accounts)
      await syncMyEntries(
        ((partRes.data as any[]) ?? []) as Participant[],
        accounts,
        prof,
      );
    } catch (e: any) {
      console.error("Competitions load failed", e);
      toast.error("Could not load competitions");
    } finally {
      setLoading(false);
    }
  };

  const syncMyEntries = async (parts: Participant[], accounts: MyAccount[], prof: any) => {
    if (!user) return;
    const mine = parts.filter(p => p.user_id === user.id);
    const updates = mine.map(async (entry) => {
      const acc = accounts.find(a => a.purchaseId === entry.purchase_id);
      if (!acc) return null;
      if (Math.abs((entry.gain_percentage ?? 0) - acc.gain) < 0.0001) return null;
      const patch = {
        display_name: prof?.display_name ?? entry.display_name,
        avatar_url: prof?.avatar_url ?? entry.avatar_url,
        account_label: acc.label,
        account_size: acc.accountSize,
        gain_percentage: acc.gain,
        profit: acc.profit,
        total_trades: acc.totalTrades,
        win_rate: acc.winRate,
        updated_at: new Date().toISOString(),
      };
      await supabase.from("competition_participants").update(patch).eq("id", entry.id);
      return { ...entry, ...patch } as Participant;
    });
    const results = (await Promise.all(updates)).filter(Boolean) as Participant[];
    if (results.length) {
      setParticipants(prev => prev.map(p => results.find(r => r.id === p.id) || p));
    }
  };

  const activeComp = useMemo(
    () => competitions.find(c => c.id === selectedComp) || null,
    [competitions, selectedComp],
  );

  const leaderboard = useMemo(() => {
    if (!activeComp) return [];
    return participants
      .filter(p => p.competition_id === activeComp.id)
      .sort((a, b) => (b.gain_percentage ?? 0) - (a.gain_percentage ?? 0));
  }, [participants, activeComp]);

  const myEntry = useMemo(
    () => leaderboard.find(p => p.user_id === user?.id) || null,
    [leaderboard, user],
  );
  const myRank = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;

  const availableAccounts = useMemo(() => {
    const used = participants
      .filter(p => p.user_id === user?.id && p.competition_id === activeComp?.id)
      .map(p => p.purchase_id);
    return myAccounts.filter(a => !used.includes(a.purchaseId));
  }, [myAccounts, participants, activeComp, user]);

  const join = async (mode: "account" | "seat") => {
    if (!user || !activeComp) return;
    const acc = mode === "account" ? myAccounts.find(a => a.purchaseId === joinAccount) : null;
    if (mode === "account" && !acc) { toast.error("Pick an account to enter with"); return; }
    try {
      setJoining(true);
      const geo = country ?? (await detectCountry());
      if (!country) setCountry(geo);
      const row: any = {
        competition_id: activeComp.id,
        user_id: user.id,
        display_name: profile?.display_name ?? "Trader",
        avatar_url: profile?.avatar_url ?? null,
        country_code: geo.code,
        country_name: geo.name,
        purchase_id: acc?.purchaseId ?? null,
        account_label: acc?.label ?? "Seat account — awaiting issue",
        account_size: acc?.accountSize ?? null,
        gain_percentage: acc?.gain ?? 0,
        profit: acc?.profit ?? 0,
        total_trades: acc?.totalTrades ?? 0,
        win_rate: acc?.winRate ?? 0,
        seat_status: mode === "seat" ? "pending" : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("competition_participants").insert(row).select().maybeSingle();
      if (error) throw error;
      setParticipants(prev => [...prev, (data as any) ?? { id: crypto.randomUUID(), ...row }]);
      setJoinAccount("");
      toast.success(mode === "seat" ? "Seat requested — admin will issue your account 🎟️" : "You're in! Good luck 🏆");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not join competition");
    } finally {
      setJoining(false);
    }
  };


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
            <div className={`w-10 h-10 rounded-xl bg-[hsl(${GOLD})]/15 flex items-center justify-center`}>
              <Trophy size={20} className={`text-[hsl(${GOLD})]`} />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Trading Competitions</h1>
              <p className="text-xs text-[hsl(220,15%,50%)]">Top traders by percentage gain win the prize pool</p>
            </div>
          </div>

          {competitions.length === 0 && (
            <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] p-12 text-center">
              <Trophy size={32} className="mx-auto text-[hsl(220,15%,25%)] mb-3" />
              <p className="text-sm text-[hsl(220,15%,55%)]">No competitions running right now. Check back soon.</p>
            </div>
          )}

          {/* Competition selector */}
          {competitions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {competitions.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedComp(c.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                    selectedComp === c.id
                      ? `bg-[hsl(${BLUE})]/15 border-[hsl(${BLUE})]/40 text-[hsl(${BLUE})]`
                      : "bg-[hsl(220,20%,6%)] border-[hsl(220,15%,12%)] text-[hsl(220,15%,55%)] hover:text-white"
                  }`}
                >
                  {c.name}
                  <span className={`ml-2 text-[10px] ${c.status === "active" ? `text-[hsl(${GREEN})]` : "text-[hsl(220,15%,40%)]"}`}>
                    {c.status === "active" ? "LIVE" : "ENDED"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeComp && (
            <>
              {/* Prize / info banner */}
              <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-gradient-to-br from-[hsl(220,20%,7%)] to-[hsl(220,25%,5%)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-lg">
                    <h2 className="text-lg font-display font-bold">{activeComp.name}</h2>
                    {activeComp.description && (
                      <p className="text-xs text-[hsl(220,15%,55%)] mt-1">{activeComp.description}</p>
                    )}
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)] flex items-center gap-1"><Gift size={11} /> Prize</p>
                      <p className={`text-lg font-bold text-[hsl(${GOLD})]`}>
                        {activeComp.prize_text || (activeComp.prize_pool ? `$${Number(activeComp.prize_pool).toLocaleString()}` : "—")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)] flex items-center gap-1"><Timer size={11} /> Time</p>
                      <p className="text-lg font-bold">{timeLeft(activeComp.ends_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)] flex items-center gap-1"><Users size={11} /> Traders</p>
                      <p className="text-lg font-bold">{leaderboard.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* My standing / join */}
              <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] p-5">
                {myEntry ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-[hsl(${BLUE})]/15 flex items-center justify-center font-bold text-[hsl(${BLUE})]`}>
                          #{myRank}
                        </div>
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            Your standing
                            <span title={myEntry.country_name || ""}>{flagEmoji(myEntry.country_code)}</span>
                          </p>
                          <p className="text-[11px] text-[hsl(220,15%,50%)]">{myEntry.account_label}</p>
                        </div>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)]">Gain</p>
                          <p className={`text-lg font-bold ${(myEntry.gain_percentage ?? 0) >= 0 ? `text-[hsl(${GREEN})]` : `text-[hsl(${RED})]`}`}>
                            {pct(myEntry.gain_percentage)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)]">Trades</p>
                          <p className="text-lg font-bold">{myEntry.total_trades ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)]">Win rate</p>
                          <p className="text-lg font-bold">{(myEntry.win_rate ?? 0).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Seat account state */}
                    {myEntry.seat_status === "pending" && (
                      <div className={`rounded-xl border border-[hsl(${GOLD})]/25 bg-[hsl(${GOLD})]/8 p-4 flex items-start gap-3`}>
                        <Ticket size={16} className={`text-[hsl(${GOLD})] mt-0.5`} />
                        <div>
                          <p className="text-xs font-semibold">Seat account — awaiting issue</p>
                          <p className="text-[11px] text-[hsl(220,15%,55%)] mt-1">
                            You're registered for this competition. Our team is preparing your seat account —
                            login details and the live equity report link will appear right here once issued.
                          </p>
                        </div>
                      </div>
                    )}

                    {myEntry.seat_status === "issued" && (
                      <div className="rounded-xl border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,8%)] p-4 space-y-3">
                        <p className="text-xs font-semibold flex items-center gap-2">
                          <KeyRound size={14} className={`text-[hsl(${GREEN})]`} /> Your seat account
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { l: "Login", v: myEntry.seat_login },
                            { l: "Password", v: myEntry.seat_password },
                            { l: "Server", v: myEntry.seat_server },
                          ].map(f => (
                            <div key={f.l}>
                              <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)]">{f.l}</p>
                              <p className="text-xs font-mono break-all">{f.v || "—"}</p>
                            </div>
                          ))}
                        </div>
                        {myEntry.seat_link && (
                          <div className="pt-2">
                            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)] mb-2">Live equity report</p>
                            <CTraderStats token={parseCTraderToken(myEntry.seat_link).token} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : activeComp.status !== "active" ? (
                  <p className="text-xs text-[hsl(220,15%,55%)]">This competition has ended.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[220px]">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,45%)] mb-1 block">
                          Enter with one of your accounts
                        </label>
                        <select
                          value={joinAccount}
                          onChange={e => setJoinAccount(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-[hsl(220,20%,8%)] border border-[hsl(220,15%,14%)] text-xs text-white focus:outline-none focus:border-[hsl(207,90%,77%)]"
                        >
                          <option value="">Select account…</option>
                          {availableAccounts.map(a => (
                            <option key={a.purchaseId} value={a.purchaseId}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                      <Button onClick={() => join("account")} disabled={joining || !joinAccount} className="h-10">
                        {joining ? <Loader2 size={14} className="animate-spin" /> : <Flame size={14} className="mr-1" />}
                        Join Competition
                      </Button>
                    </div>

                    <div className="rounded-xl border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,8%)] p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="max-w-md">
                        <p className="text-xs font-semibold flex items-center gap-2">
                          <Ticket size={14} className={`text-[hsl(${GOLD})]`} /> No account? Grab a free seat account
                        </p>
                        <p className="text-[11px] text-[hsl(220,15%,55%)] mt-1">
                          No purchase required. Request a seat and our team issues you a competition
                          seat account with a live report link so you can watch your equity update.
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => join("seat")} disabled={joining} className="h-10">
                        {joining ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} className="mr-1" />}
                        Request seat account
                      </Button>
                    </div>

                    <p className="text-[11px] text-[hsl(220,15%,45%)] flex items-center gap-2">
                      Joining from {flagEmoji(country?.code)} {country?.name || "detecting…"}
                    </p>
                  </div>
                )}

              </div>

              {/* Leaderboard */}
              <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(220,15%,12%)] flex items-center gap-2">
                  <TrendingUp size={15} className={`text-[hsl(${BLUE})]`} />
                  <h3 className="text-sm font-display font-semibold">Leaderboard · Top % Gain</h3>
                </div>

                {leaderboard.length === 0 ? (
                  <p className="text-xs text-[hsl(220,15%,50%)] text-center py-12">
                    No traders yet — be the first to join.
                  </p>
                ) : (
                  <div className="divide-y divide-[hsl(220,15%,10%)]">
                    {leaderboard.map((p, i) => {
                      const isMe = p.user_id === user?.id;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-5 py-3 ${isMe ? `bg-[hsl(${BLUE})]/5` : ""}`}
                        >
                          <div className="w-7 flex justify-center">{rankBadge(i)}</div>
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.display_name || "Trader"} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[hsl(220,15%,14%)] flex items-center justify-center text-[11px] font-bold">
                              {(p.display_name || "T")[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-base leading-none" title={p.country_name || "Unknown"}>
                            {flagEmoji(p.country_code)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {p.display_name || "Trader"}{isMe && <span className={`ml-2 text-[10px] text-[hsl(${BLUE})]`}>YOU</span>}
                            </p>
                            <p className="text-[10px] text-[hsl(220,15%,45%)] truncate">
                              {[p.country_name, p.account_label].filter(Boolean).join(" · ") || "—"}
                              {p.seat_status === "pending" && <span className={`ml-2 text-[hsl(${GOLD})]`}>seat pending</span>}
                            </p>
                          </div>

                          <div className="hidden sm:block text-right w-16">
                            <p className="text-[10px] text-[hsl(220,15%,45%)]">Trades</p>
                            <p className="text-xs font-semibold">{p.total_trades ?? 0}</p>
                          </div>
                          <div className="hidden sm:block text-right w-16">
                            <p className="text-[10px] text-[hsl(220,15%,45%)]">Win</p>
                            <p className="text-xs font-semibold">{(p.win_rate ?? 0).toFixed(0)}%</p>
                          </div>
                          <div className="text-right w-20">
                            <p className={`text-sm font-bold ${(p.gain_percentage ?? 0) >= 0 ? `text-[hsl(${GREEN})]` : `text-[hsl(${RED})]`}`}>
                              {pct(p.gain_percentage)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardCompetitions;
