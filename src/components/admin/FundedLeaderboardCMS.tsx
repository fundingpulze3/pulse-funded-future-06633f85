import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import { toast } from "sonner";
import { BadgeDollarSign, Plus, Trash2, Loader2, RefreshCw, Crown, Pencil, Check, X } from "lucide-react";

type Row = {
  id: string;
  user_id: string | null;
  purchase_id: string | null;
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
  updated_at?: string;
};

const emptyForm = {
  display_name: "",
  country: "",
  account_label: "",
  avatar_url: "",
  account_size: "",
  gain_percentage: "",
  profit: "",
  payout_total: "",
  total_trades: "",
  win_rate: "",
};

const FIRST = ["Liam","Noah","Oliver","Elijah","James","Lucas","Mateo","Ethan","Aiden","Leo","Arjun","Rohan","Aditya","Vikram","Kabir","Omar","Yusuf","Ali","Hassan","Karim","Chen","Wei","Hiroshi","Kenji","Minho","Jisoo","Lars","Erik","Nikolai","Dmitri","Marco","Luca","Diego","Santiago","Mateus","Rafael","Pierre","Louis","Tomas","Jakub","Andres","Felipe","Sofia","Emma","Olivia","Ava","Isabella","Mia","Ananya","Priya","Layla","Zara","Nora","Elena","Marta","Ingrid","Freya","Chloe","Amara","Sanaa","Ibrahim","Daniel","Michael","Ryan","Jordan","Tyler","Nathan","Adrian","Victor","Samuel","Gabriel","Antoine","Mustafa","Bilal","Tariq","Ahmed","Rahul","Kiran","Manish","Sahil","Tanvir","Owen","Henry","Jack","Charlie","George","Harvey","Finn","Kai","Zane","Milan","Stefan","Ivan","Pavel","Sergei","Hugo","Enzo","Bruno","Caio","Thiago","Nolan","Aaron"];
const LAST = ["Anderson","Bennett","Carter","Dawson","Ellis","Foster","Garcia","Hughes","Ibrahim","Jensen","Khan","Larsen","Morgan","Novak","Owens","Patel","Quinn","Reyes","Silva","Turner","Ueda","Vargas","Walsh","Yamada","Zhang","Kowalski","Petrov","Rossi","Moreau","Sharma","Nakamura","Okafor","Haddad","Fernandes","Lindqvist","Moretti","Sullivan","Baptiste","Duarte","Kimura"];
const COUNTRIES = ["India","United States","United Kingdom","Canada","Germany","France","Spain","Italy","Brazil","Mexico","UAE","Saudi Arabia","Nigeria","South Africa","Australia","Japan","South Korea","Singapore","Netherlands","Poland","Sweden","Norway","Turkey","Egypt","Indonesia","Malaysia","Philippines","Vietnam","Portugal","Argentina"];
const SIZES = [5000, 10000, 25000, 50000, 100000, 200000];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (min: number, max: number, dp = 2) => Number((Math.random() * (max - min) + min).toFixed(dp));

const makeFakeTrader = () => {
  const size = pick(SIZES);
  const gain = rnd(2.5, 48);
  const profit = Number(((size * gain) / 100).toFixed(2));
  return {
    display_name: `${pick(FIRST)} ${pick(LAST)}`,
    country: pick(COUNTRIES),
    avatar_url: null,
    account_label: `Funded · $${size.toLocaleString()}`,
    account_size: size,
    gain_percentage: gain,
    profit,
    payout_total: Number((profit * rnd(0.4, 0.85, 2)).toFixed(2)),
    total_trades: Math.floor(rnd(24, 480, 0)),
    win_rate: rnd(46, 82, 1),
  };
};

const input = "w-full h-9 px-3 rounded-lg border border-[hsl(0,0%,88%)] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-black";

const FundedLeaderboardCMS = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("funded_leaderboard").select("*");
    setRows(((data as any[]) ?? []) as Row[]);
    setLoading(false);
  };

  const fetchAllRows = async (table: string, columns = "*") => {
    const out: any[] = [];
    let from = 0;
    const size = 1000;
    while (true) {
      const { data, error } = await supabase.from(table as any).select(columns).range(from, from + size - 1);
      if (error || !data || data.length === 0) break;
      out.push(...data);
      if (data.length < size) break;
      from += size;
    }
    return out;
  };

  /** Pull every real funded account into the board (fake entries untouched). */
  const syncReal = async () => {
    try {
      setSyncing(true);
      const [purchases, profiles, challenges, certs, payouts] = await Promise.all([
        fetchAllRows("challenge_purchases", "*"),
        fetchAllRows("profiles", "user_id, display_name, avatar_url, country, email"),
        fetchAllRows("challenges", "id, name, account_size"),
        fetchAllRows("user_certificates", "purchase_id, stats"),
        fetchAllRows("payout_requests", "purchase_id, amount, status"),
      ]);

      const funded = purchases.filter(p => String(p.status || "").toLowerCase() === "funded");
      const rich = (s: any) => s && typeof s === "object" &&
        (typeof s.balance === "number" || typeof s.equity === "number" || typeof s.profit === "number");

      const built = funded.map(p => {
        const prof = profiles.find(x => x.user_id === p.user_id);
        const ch = challenges.find(c => c.id === p.challenge_id);
        const size = Number(ch?.account_size || 0);
        const cert = certs.find(c => c.purchase_id === p.id && rich(c.stats));
        const s: any = cert?.stats || {};
        const balance = Number(s.equity ?? s.balance ?? size);
        const profit = Number(s.profit ?? (balance - size));
        const gain = size > 0 ? (profit / size) * 100 : 0;
        const paid = payouts
          .filter(x => x.purchase_id === p.id && String(x.status).toLowerCase() === "approved")
          .reduce((t, x) => t + Number(x.amount || 0), 0);
        return {
          user_id: p.user_id,
          purchase_id: p.id,
          display_name: prof?.display_name || prof?.email?.split("@")[0] || "Trader",
          avatar_url: prof?.avatar_url ?? null,
          country: prof?.country ?? null,
          account_label: `${ch?.name || "Funded"} · $${size.toLocaleString()}`,
          account_size: size,
          gain_percentage: Number.isFinite(gain) ? gain : 0,
          profit: Number.isFinite(profit) ? profit : 0,
          payout_total: paid,
          total_trades: Number(s.totalTrades ?? 0),
          win_rate: Number(s.winRate ?? 0),
          source: "real",
          updated_at: new Date().toISOString(),
        };
      });

      // Replace previously synced real rows, keep manual ones.
      const existingReal = rows.filter(r => r.source === "real");
      for (const r of existingReal) {
        await supabase.from("funded_leaderboard").delete().eq("id", r.id);
      }
      for (const b of built) {
        await supabase.from("funded_leaderboard").insert({ id: crypto.randomUUID(), ...b });
      }
      toast.success(`Synced ${built.length} funded accounts`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const payload = (f: typeof emptyForm) => ({
    display_name: f.display_name || "Trader",
    country: f.country || null,
    account_size: f.account_size ? Number(f.account_size) : null,
    gain_percentage: f.gain_percentage ? Number(f.gain_percentage) : 0,
    profit: f.profit ? Number(f.profit) : 0,
    payout_total: f.payout_total ? Number(f.payout_total) : 0,
    total_trades: f.total_trades ? Number(f.total_trades) : 0,
    win_rate: f.win_rate ? Number(f.win_rate) : 0,
    account_label: f.account_size ? `Funded · $${Number(f.account_size).toLocaleString()}` : null,
  });

  const add = async () => {
    if (!form.display_name) return toast.error("Name is required");
    try {
      setSaving(true);
      const { error } = await supabase.from("funded_leaderboard").insert({
        id: crypto.randomUUID(),
        user_id: null,
        purchase_id: null,
        avatar_url: null,
        source: "manual",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload(form),
      });
      if (error) throw error;
      toast.success("Entry added");
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: Row) => {
    setEditId(r.id);
    setEditForm({
      display_name: r.display_name || "",
      country: r.country || "",
      account_size: String(r.account_size ?? ""),
      gain_percentage: String(r.gain_percentage ?? ""),
      profit: String(r.profit ?? ""),
      payout_total: String(r.payout_total ?? ""),
      total_trades: String(r.total_trades ?? ""),
      win_rate: String(r.win_rate ?? ""),
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    const { error } = await supabase.from("funded_leaderboard")
      .update({ ...payload(editForm), updated_at: new Date().toISOString() })
      .eq("id", editId);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this entry from the leaderboard?")) return;
    const { error } = await supabase.from("funded_leaderboard").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const ranked = [...rows].sort((a, b) => (b.gain_percentage ?? 0) - (a.gain_percentage ?? 0));

  return (
    <div className="space-y-4">
      {/* Add manual entry */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BadgeDollarSign size={16} />
            <h3 className="text-sm font-display font-semibold">Funded Leaderboard</h3>
          </div>
          <button onClick={syncReal} disabled={syncing}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[hsl(0,0%,88%)] text-xs font-semibold disabled:opacity-50">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync real funded accounts
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className={input} placeholder="Trader name" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          <input className={input} placeholder="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          <input className={input} type="number" placeholder="Account size ($)" value={form.account_size} onChange={e => setForm({ ...form, account_size: e.target.value })} />
          <input className={input} type="number" placeholder="Gain %" value={form.gain_percentage} onChange={e => setForm({ ...form, gain_percentage: e.target.value })} />
          <input className={input} type="number" placeholder="Profit ($)" value={form.profit} onChange={e => setForm({ ...form, profit: e.target.value })} />
          <input className={input} type="number" placeholder="Payouts ($)" value={form.payout_total} onChange={e => setForm({ ...form, payout_total: e.target.value })} />
          <input className={input} type="number" placeholder="Trades" value={form.total_trades} onChange={e => setForm({ ...form, total_trades: e.target.value })} />
          <input className={input} type="number" placeholder="Win rate %" value={form.win_rate} onChange={e => setForm({ ...form, win_rate: e.target.value })} />
        </div>
        <button onClick={add} disabled={saving}
          className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-black text-white text-xs font-semibold disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add entry
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : ranked.length === 0 ? (
          <p className="text-xs text-[hsl(0,0%,50%)] text-center py-10">No entries yet — sync real accounts or add one above.</p>
        ) : (
          <div className="divide-y divide-[hsl(0,0%,95%)]">
            {ranked.map((r, i) => (
              <div key={r.id} className="py-2">
                {editId === r.id ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                    <input className={input} value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} />
                    <input className={input} value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} />
                    <input className={input} type="number" value={editForm.account_size} onChange={e => setEditForm({ ...editForm, account_size: e.target.value })} />
                    <input className={input} type="number" value={editForm.gain_percentage} onChange={e => setEditForm({ ...editForm, gain_percentage: e.target.value })} />
                    <input className={input} type="number" value={editForm.profit} onChange={e => setEditForm({ ...editForm, profit: e.target.value })} />
                    <input className={input} type="number" value={editForm.payout_total} onChange={e => setEditForm({ ...editForm, payout_total: e.target.value })} />
                    <input className={input} type="number" value={editForm.total_trades} onChange={e => setEditForm({ ...editForm, total_trades: e.target.value })} />
                    <div className="flex gap-2">
                      <input className={input} type="number" value={editForm.win_rate} onChange={e => setEditForm({ ...editForm, win_rate: e.target.value })} />
                      <button onClick={saveEdit} className="h-9 w-9 shrink-0 rounded-lg bg-black text-white flex items-center justify-center"><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} className="h-9 w-9 shrink-0 rounded-lg border border-[hsl(0,0%,88%)] flex items-center justify-center"><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-xs font-semibold text-[hsl(0,0%,45%)] flex justify-center">
                      {i === 0 ? <Crown size={13} className="text-[hsl(45,90%,45%)]" /> : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {r.display_name || "Trader"}
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${r.source === "real" ? "bg-[hsl(142,60%,95%)] text-[hsl(142,60%,28%)]" : "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,45%)]"}`}>
                          {r.source === "real" ? "real" : "manual"}
                        </span>
                      </p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)] truncate">
                        {[r.country, r.account_label].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="text-[11px] text-[hsl(0,0%,45%)] w-20 text-right">${Math.round(Number(r.payout_total ?? 0)).toLocaleString()} paid</span>
                    <span className="text-[11px] text-[hsl(0,0%,45%)] w-16 text-right">{r.total_trades ?? 0} trades</span>
                    <span className={`text-xs font-bold w-16 text-right ${(r.gain_percentage ?? 0) >= 0 ? "text-[hsl(142,60%,32%)]" : "text-[hsl(0,70%,45%)]"}`}>
                      {(r.gain_percentage ?? 0) >= 0 ? "+" : ""}{(r.gain_percentage ?? 0).toFixed(2)}%
                    </span>
                    <button onClick={() => startEdit(r)} className="h-8 w-8 rounded-lg border border-[hsl(0,0%,88%)] flex items-center justify-center"><Pencil size={13} /></button>
                    <button onClick={() => remove(r.id)} className="h-8 w-8 rounded-lg border border-[hsl(0,0%,88%)] flex items-center justify-center text-[hsl(0,70%,45%)]"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundedLeaderboardCMS;
