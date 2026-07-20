import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Play, Send, Sparkles, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type Usage = { id: string; day: string; topic: string | null; cost_usd: number; words: number; ok: boolean; created_at: string };
type Topic = { id: string; query: string; category: string | null; country: string | null; source: string; status: string };
type SlotRun = { slot: string; status: string; note: string | null };

const card = "bg-white rounded-lg border border-[hsl(0,0%,88%)] p-4";
const muted = "text-[hsl(0,0%,45%)]";

const BlogAutoPilot = () => {
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [slots, setSlots] = useState("09:00,14:00,19:00");
  const [usage, setUsage] = useState<Usage[]>([]);
  const [queue, setQueue] = useState<Topic[]>([]);
  const [runs, setRuns] = useState<SlotRun[]>([]);
  const [q, setQ] = useState(""); const [note, setNote] = useState(""); const [cat, setCat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const day = new Date().toISOString().slice(0, 10);
    const [s, u, t, r] = await Promise.all([
      supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("blog_engine_usage").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("blog_topics").select("*").eq("status", "queued").order("priority", { ascending: false }).order("created_at").limit(20),
      supabase.from("blog_slot_runs").select("slot,status,note").eq("day", day),
    ]);
    if (s.data) { setAuto(!!s.data.auto_publish); setSlots(s.data.slots || "09:00,14:00,19:00"); }
    setUsage((u.data as Usage[]) ?? []); setQueue((t.data as Topic[]) ?? []); setRuns((r.data as SlotRun[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("blog-engine", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const saveSchedule = async (nextAuto: boolean, nextSlots = slots) => {
    setAuto(nextAuto);
    const { error } = await supabase.from("blog_settings").update({ auto_publish: nextAuto, slots: nextSlots, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success(nextAuto ? "Auto-posting on" : "Auto-posting off");
  };

  const act = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    try { await fn(); toast.success(ok); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todays = usage.filter((u) => u.day === today && u.ok);
  const spentToday = todays.reduce((s, u) => s + Number(u.cost_usd || 0), 0);
  const okAll = usage.filter((u) => u.ok);
  const totalCost = okAll.reduce((s, u) => s + Number(u.cost_usd || 0), 0);
  const totalWords = okAll.reduce((s, u) => s + Number(u.words || 0), 0);
  const avgWords = okAll.length ? Math.round(totalWords / okAll.length) : 0;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const weekBlogs = okAll.filter((u) => u.day >= weekAgo).length;
  const perDay = Object.entries(okAll.reduce((m: Record<string, { blogs: number; cost: number }>, u) => {
    (m[u.day] ||= { blogs: 0, cost: 0 }); m[u.day].blogs++; m[u.day].cost += Number(u.cost_usd || 0); return m;
  }, {})).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);

  if (loading) return <div className={`flex items-center gap-2 text-sm ${muted}`}><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Write / queue a blog */}
      <div className={card}>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles size={15} /> Write a blog</h2>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Topic or target query — e.g. how to pass a 2-step evaluation in the UK" className="text-sm" />
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-sm mt-2"
          placeholder="Optional research to build on (paste findings, angles, data the article should use)" />
        <div className="flex gap-2 mt-2">
          <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Category (optional)" className="text-sm max-w-[200px]" />
          <Button size="sm" disabled={!!busy || !q.trim()} onClick={() => act("gen", async () => { await call("queue", { query: q, research_note: note, category: cat, priority: 200 }); await call("run_slot"); setQ(""); setNote(""); setCat(""); }, "Written and posted")}>
            {busy === "gen" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Write &amp; post now
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy || !q.trim()} onClick={() => act("q", async () => { await call("queue", { query: q, research_note: note, category: cat }); setQ(""); setNote(""); setCat(""); }, "Queued — it'll post automatically")}>
            <Send size={14} /> Queue it
          </Button>
        </div>
      </div>

      {/* Auto-posting */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{auto ? "Auto-posting is ON" : "Auto-posting is OFF"}</h2>
            <p className={`text-[11px] ${muted}`}>{slots.split(",").filter(Boolean).length} blogs a day · {slots} UTC</p>
          </div>
          <Switch checked={auto} onCheckedChange={(v) => saveSchedule(v)} />
        </div>
        <div className="flex gap-2 mt-3">
          <Input value={slots} onChange={(e) => setSlots(e.target.value)} onBlur={() => saveSchedule(auto, slots)} className="text-sm max-w-[240px]" placeholder="09:00,14:00,19:00" />
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("slot", () => call("run_slot"), "Posted")}>
            {busy === "slot" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run a slot now
          </Button>
        </div>
        {runs.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {runs.map((r) => (
              <span key={r.slot} className={`text-[11px] px-2 py-0.5 rounded border ${r.status === "posted" ? "border-green-300 text-green-700 bg-green-50" : r.status === "skipped" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-red-300 text-red-700 bg-red-50"}`}>
                {r.slot} · {r.status}{r.note ? ` (${r.note})` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming queue */}
      {queue.length > 0 && (
        <div className={card}>
          <h2 className="text-sm font-semibold mb-2">Upcoming queue — next {queue.length}</h2>
          <div className="divide-y divide-[hsl(0,0%,92%)]">
            {queue.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 py-2 text-sm">
                <span className={`text-[11px] ${muted} w-5`}>{i + 1}</span>
                <span className="flex-1 truncate">{t.query}</span>
                {t.source === "feed" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0,0%,94%)]">pinned</span>}
                <button className={`text-[11px] ${muted} hover:text-blue-600`} onClick={async () => {
                  const next = window.prompt("Edit this queued topic:", t.query);
                  if (!next?.trim()) return;
                  await supabase.from("blog_topics").update({ query: next.trim() }).eq("id", t.id); load();
                }}><Pencil size={13} /></button>
                <button className={`text-[11px] ${muted} hover:text-red-600`} onClick={async () => {
                  await supabase.from("blog_topics").delete().eq("id", t.id); load(); toast.success("Removed");
                }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI spend */}
      <div className={card}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold">AI spend</h2>
          <div className="flex gap-4 text-xs flex-wrap">
            <span className={muted}>Spent: <b className="text-black">${totalCost.toFixed(2)}</b></span>
            <span className={muted}>Blogs: <b className="text-black">{okAll.length}</b></span>
            <span className={muted}>This week: <b className="text-black">{weekBlogs}</b></span>
            <span className={muted}>Words: <b className="text-black">{totalWords.toLocaleString()}</b></span>
            <span className={muted}>Avg: <b className="text-black">{avgWords.toLocaleString()}</b></span>
            <span className={`font-semibold ${spentToday >= 0.45 ? "text-red-600" : "text-green-600"}`}>
              Today: ${spentToday.toFixed(2)} / $0.45 · {todays.length}/10 blogs
            </span>
          </div>
        </div>
        {perDay.length > 0 && (
          <div className="mt-3 space-y-1">
            {perDay.map(([day, d]) => (
              <div key={day} className="flex items-center gap-2 text-xs">
                <span className={`${muted} w-20`}>{day.slice(5)}</span>
                <div className="flex-1 h-2 bg-[hsl(0,0%,94%)] rounded overflow-hidden">
                  <div className="h-full bg-black/70" style={{ width: `${Math.min(100, (d.blogs / 10) * 100)}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums">{d.blogs} · ${d.cost.toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent */}
      <div className={card}>
        <h2 className="text-sm font-semibold mb-2">Recent generations</h2>
        {usage.length === 0 ? <p className={`text-sm ${muted}`}>Nothing yet.</p> : (
          <div className="divide-y divide-[hsl(0,0%,92%)] text-sm">
            {usage.slice(0, 10).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate flex-1">{u.topic || "—"}</span>
                <span className={`text-xs ${muted} whitespace-nowrap`}>{new Date(u.created_at).toLocaleString()}</span>
                <span className="text-xs tabular-nums">{u.words ? `${u.words}w` : ""}</span>
                <span className="text-xs tabular-nums">${Number(u.cost_usd || 0).toFixed(3)}</span>
                <span className={`text-xs ${u.ok ? "text-green-600" : "text-red-600"}`}>{u.ok ? "ok" : "failed"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogAutoPilot;
