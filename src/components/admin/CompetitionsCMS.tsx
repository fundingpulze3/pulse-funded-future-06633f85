import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import { toast } from "sonner";
import { Trophy, Plus, Trash2, Loader2, Users, Crown, Ticket, Check } from "lucide-react";
import { flagEmoji } from "@/lib/country";

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
  user_id?: string | null;
  display_name: string | null;
  account_label: string | null;
  gain_percentage: number | null;
  total_trades: number | null;
  country_code?: string | null;
  country_name?: string | null;
  account_size?: number | null;
  seat_status?: string | null;
  seat_login?: string | null;
  seat_password?: string | null;
  seat_server?: string | null;
  seat_link?: string | null;
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
  const [seatOpen, setSeatOpen] = useState<string | null>(null);
  const [seatForm, setSeatForm] = useState({ seat_login: "", seat_password: "", seat_server: "", seat_link: "", account_size: "100000" });
  const [issuing, setIssuing] = useState(false);
  const [emails, setEmails] = useState<Record<string, string>>({});

  const openSeat = (p: Participant) => {
    setSeatOpen(seatOpen === p.id ? null : p.id);
    setSeatForm({
      seat_login: p.seat_login || "",
      seat_password: p.seat_password || "",
      seat_server: p.seat_server || "",
      seat_link: p.seat_link || "",
      account_size: String(p.account_size ?? 100000),
    });
  };

  const issueSeat = async (p: Participant) => {
    if (!seatForm.seat_login || !seatForm.seat_server) {
      toast.error("Login and server are required");
      return;
    }
    try {
      setIssuing(true);
      const size = Number(seatForm.account_size) || 100000;
      const patch = {
        seat_login: seatForm.seat_login,
        seat_password: seatForm.seat_password,
        seat_server: seatForm.seat_server,
        seat_link: seatForm.seat_link,
        account_size: size,
        seat_status: "issued",
        account_label: `Seat account · $${size.toLocaleString()}`,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("competition_participants").update(patch).eq("id", p.id);
      if (error) throw error;
      setParticipants(prev => prev.map(x => (x.id === p.id ? { ...x, ...patch } : x)));
      setSeatOpen(null);
      toast.success(seatForm.seat_link ? "Seat issued — live sync started" : "Seat account issued");
    } catch (e: any) {
      toast.error(e?.message || "Failed to issue seat");
    } finally {
      setIssuing(false);
    }
  };


  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [c, p, pr] = await Promise.all([
      supabase.from("competitions").select("*").order("starts_at", { ascending: false }),
      supabase.from("competition_participants").select("*"),
      supabase.from("profiles").select("user_id, email, display_name"),
    ]);
    setComps(((c.data as any[]) ?? []) as Competition[]);
    setParticipants(((p.data as any[]) ?? []) as Participant[]);
    const map: Record<string, string> = {};
    ((pr.data as any[]) ?? []).forEach((r: any) => { if (r.user_id) map[r.user_id] = r.email || ""; });
    setEmails(map);
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

  const pendingRequests = participants.filter(p => !p.seat_login || p.seat_status === "pending");

  return (
    <div className="space-y-4">
      {/* Account requests */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Ticket size={16} />
          <h3 className="text-sm font-display font-semibold">Account requests</h3>
          <span className="ml-1 inline-flex items-center h-5 px-2 rounded-full bg-[hsl(45,90%,94%)] border border-[hsl(45,80%,70%)] text-[10px] font-bold text-[hsl(38,80%,32%)]">
            {pendingRequests.length} account needed
          </span>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="text-xs text-[hsl(0,0%,50%)]">Everyone who joined has an account assigned.</p>
        ) : (
          <div className="divide-y divide-[hsl(0,0%,95%)]">
            {pendingRequests.map(p => {
              const comp = comps.find(c => c.id === p.competition_id);
              return (
                <div key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base leading-none" title={p.country_name || "Unknown"}>{flagEmoji(p.country_code)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{p.display_name || "Trader"}</p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)] truncate">
                        {(p.user_id && emails[p.user_id]) || "no email on file"} · {comp?.name || "competition"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[hsl(45,90%,95%)] border border-[hsl(45,80%,70%)] text-[10px] font-bold text-[hsl(38,80%,32%)]">
                      <Ticket size={11} /> Account needed
                    </span>
                    <button onClick={() => openSeat(p)} className="h-8 px-3 rounded-lg bg-black text-white text-[11px] font-semibold">
                      {seatOpen === p.id ? "Close" : "Assign account"}
                    </button>
                  </div>

                  {seatOpen === p.id && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input className={input} placeholder="Login" value={seatForm.seat_login} onChange={e => setSeatForm({ ...seatForm, seat_login: e.target.value })} />
                      <input className={input} placeholder="Password" value={seatForm.seat_password} onChange={e => setSeatForm({ ...seatForm, seat_password: e.target.value })} />
                      <input className={input} placeholder="Server" value={seatForm.seat_server} onChange={e => setSeatForm({ ...seatForm, seat_server: e.target.value })} />
                      <input className={input} type="number" placeholder="Account size ($)" value={seatForm.account_size} onChange={e => setSeatForm({ ...seatForm, account_size: e.target.value })} />
                      <input className={`${input} md:col-span-2`} placeholder="cTrader investor link (starts live sync)" value={seatForm.seat_link} onChange={e => setSeatForm({ ...seatForm, seat_link: e.target.value })} />
                      <button onClick={() => issueSeat(p)} disabled={issuing} className="h-9 px-4 rounded-lg bg-black text-white text-xs font-semibold disabled:opacity-50">
                        {issuing ? "Saving…" : "Issue account & start sync"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                  {rows.map((p, i) => (
                    <div key={p.id} className="py-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs font-semibold text-[hsl(0,0%,45%)] flex justify-center">
                          {i === 0 ? <Crown size={13} className="text-[hsl(45,90%,45%)]" /> : i + 1}
                        </span>
                        <span className="text-base leading-none" title={p.country_name || "Unknown"}>{flagEmoji(p.country_code)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.display_name || "Trader"}</p>
                          <p className="text-[10px] text-[hsl(0,0%,50%)] truncate">
                            {[p.country_name, p.account_label].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {p.seat_status && (
                          <button
                            onClick={() => openSeat(p)}
                            className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold border ${
                              p.seat_status === "issued"
                                ? "border-[hsl(142,50%,70%)] text-[hsl(142,60%,30%)] bg-[hsl(142,60%,96%)]"
                                : "border-[hsl(45,80%,65%)] text-[hsl(38,80%,32%)] bg-[hsl(45,90%,95%)]"
                            }`}
                          >
                            {p.seat_status === "issued" ? <Check size={12} /> : <Ticket size={12} />}
                            {p.seat_status === "issued" ? "Seat issued" : "Issue seat"}
                          </button>
                        )}
                        <span className="text-[11px] text-[hsl(0,0%,45%)]">{p.total_trades ?? 0} trades</span>
                        <span className={`text-xs font-bold w-16 text-right ${(p.gain_percentage ?? 0) >= 0 ? "text-[hsl(142,60%,32%)]" : "text-[hsl(0,70%,45%)]"}`}>
                          {(p.gain_percentage ?? 0) >= 0 ? "+" : ""}{(p.gain_percentage ?? 0).toFixed(2)}%
                        </span>
                      </div>

                      {seatOpen === p.id && (
                        <div className="mt-2 ml-9 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                          <input className={input} placeholder="Login" value={seatForm.seat_login} onChange={e => setSeatForm({ ...seatForm, seat_login: e.target.value })} />
                          <input className={input} placeholder="Password" value={seatForm.seat_password} onChange={e => setSeatForm({ ...seatForm, seat_password: e.target.value })} />
                          <input className={input} placeholder="Server" value={seatForm.seat_server} onChange={e => setSeatForm({ ...seatForm, seat_server: e.target.value })} />
                          <input className={input} placeholder="Report link (cTrader investor)" value={seatForm.seat_link} onChange={e => setSeatForm({ ...seatForm, seat_link: e.target.value })} />
                          <button
                            onClick={() => issueSeat(p)}
                            disabled={issuing}
                            className="h-9 px-4 rounded-lg bg-black text-white text-xs font-semibold disabled:opacity-50 md:col-span-1"
                          >
                            {issuing ? "Saving…" : "Issue seat account"}
                          </button>
                        </div>
                      )}
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
