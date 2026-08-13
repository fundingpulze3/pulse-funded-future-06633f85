import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import { toast } from "sonner";
import { Trophy, Plus, Trash2, Loader2, Users, Crown } from "lucide-react";

type Competition = {
  id: string;
  name: string;
  description: string | null;
  prize_text: string | null;
  prize_pool: number | null;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at?: string;
};

type Participant = {
  id: string;
  competition_id: string;
  display_name: string | null;
  account_label: string | null;
  gain_percentage: number | null;
  total_trades: number | null;
};

const emptyForm = {
  name: "",
  description: "",
  prize_text: "",
  prize_pool: "",
  starts_at: "",
  ends_at: "",
  status: "active",
};

const CompetitionsCMS = () => {
  const [comps, setComps] = useState<Competition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from("competitions").select("*").order("starts_at", { ascending: false }),
      supabase.from("competition_participants").select("*"),
    ]);
    setComps(((c.data as any[]) ?? []) as Competition[]);
    setParticipants(((p.data as any[]) ?? []) as Participant[]);
    setLoading(false);
  };

  const create = async () => {
    if (!form.name || !form.starts_at || !form.ends_at) {
      toast.error("Name, start and end date are required");
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.from("competitions").insert({
        name: form.name,
        description: form.description || null,
        prize_text: form.prize_text || null,
        prize_pool: form.prize_pool ? Number(form.prize_pool) : null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        status: form.status,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Competition created");
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("competitions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setComps(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this competition and all its entries?")) return;
    await supabase.from("competition_participants").delete().eq("competition_id", id);
    const { error } = await supabase.from("competitions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const input = "w-full h-9 px-3 rounded-lg border border-[hsl(0,0%,88%)] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-black";

  return (
    <div className="space-y-4">
      {/* Create */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} />
          <h3 className="text-sm font-display font-semibold">New Competition</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={input} placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className={input} placeholder="Prize text (e.g. $5,000 + Funded Account)" value={form.prize_text} onChange={e => setForm({ ...form, prize_text: e.target.value })} />
          <input className={input} type="number" placeholder="Prize pool ($)" value={form.prize_pool} onChange={e => setForm({ ...form, prize_pool: e.target.value })} />
          <input className={input} type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
          <input className={input} type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
          <select className={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="ended">Ended</option>
          </select>
          <textarea className="md:col-span-3 px-3 py-2 rounded-lg border border-[hsl(0,0%,88%)] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-black" rows={2} placeholder="Description / rules" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <button onClick={create} disabled={saving} className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-black text-white text-xs font-semibold disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
      ) : comps.length === 0 ? (
        <p className="text-xs text-[hsl(0,0%,50%)] text-center py-10">No competitions yet.</p>
      ) : (
        comps.map(c => {
          const rows = participants
            .filter(p => p.competition_id === c.id)
            .sort((a, b) => (b.gain_percentage ?? 0) - (a.gain_percentage ?? 0));
          return (
            <div key={c.id} className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[11px] text-[hsl(0,0%,50%)]">
                    {new Date(c.starts_at).toLocaleDateString()} → {new Date(c.ends_at).toLocaleDateString()} ·{" "}
                    {c.prize_text || (c.prize_pool ? `$${c.prize_pool.toLocaleString()}` : "no prize set")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(0,0%,45%)]"><Users size={12} />{rows.length}</span>
                  <select value={c.status} onChange={e => setStatus(c.id, e.target.value)} className="h-8 px-2 rounded-lg border border-[hsl(0,0%,88%)] text-xs bg-white">
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="ended">Ended</option>
                  </select>
                  <button onClick={() => remove(c.id)} className="h-8 w-8 rounded-lg border border-[hsl(0,0%,88%)] flex items-center justify-center text-[hsl(0,70%,45%)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {rows.length > 0 && (
                <div className="divide-y divide-[hsl(0,0%,95%)]">
                  {rows.slice(0, 15).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-2">
                      <span className="w-6 text-xs font-semibold text-[hsl(0,0%,45%)] flex justify-center">
                        {i === 0 ? <Crown size={13} className="text-[hsl(45,90%,45%)]" /> : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.display_name || "Trader"}</p>
                        <p className="text-[10px] text-[hsl(0,0%,50%)] truncate">{p.account_label}</p>
                      </div>
                      <span className="text-[11px] text-[hsl(0,0%,45%)]">{p.total_trades ?? 0} trades</span>
                      <span className={`text-xs font-bold w-16 text-right ${(p.gain_percentage ?? 0) >= 0 ? "text-[hsl(142,60%,32%)]" : "text-[hsl(0,70%,45%)]"}`}>
                        {(p.gain_percentage ?? 0) >= 0 ? "+" : ""}{(p.gain_percentage ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default CompetitionsCMS;
