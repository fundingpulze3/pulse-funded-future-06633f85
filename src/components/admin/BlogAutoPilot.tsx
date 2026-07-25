import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEngineStatus, saveEngineSettings } from "@/lib/blogEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Play, Send, Sparkles, Trash2, Pencil, Eye, Clock, MousePointerClick, BarChart3 } from "lucide-react";
import { toast } from "sonner";

type Usage = { id: string; day: string; topic: string | null; cost_usd: number; words: number; ok: boolean; created_at: string };
type Topic = { id: string; query: string; category: string | null; country: string | null; source: string; status: string };
type SlotRun = { slot: string; status: string; note: string | null };
type Ev = { post_id: string; type: string; seconds: number; cta_label: string | null; session_id: string | null };
type Post = { id: string; title: string; views_count: number };

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
  const [lastPost, setLastPost] = useState<{ title: string; published_at: string } | null>(null);
  const [preparedCount, setPreparedCount] = useState(0);
  const [events, setEvents] = useState<Ev[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [recentPosts, setRecentPosts] = useState<{ id: string; title: string; slug: string; created_at: string; is_published: boolean }[]>([]);
  const [engineDown, setEngineDown] = useState(false);
  const [tablesOk, setTablesOk] = useState(true);
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(i); }, []);

  const load = useCallback(async () => {
    const safe = async <T,>(fn: () => PromiseLike<{ data: T | null }>): Promise<T | null> => {
      try { const r = await fn(); return (r?.data ?? null) as T | null; } catch { return null; }
    };
    const day = new Date().toISOString().slice(0, 10);

    // The engine is authoritative — it works whether or not the tables exist.
    try {
      const st = await getEngineStatus();
      setEngineDown(false);
      setTablesOk(!!st.usingTables);
      setAuto(!!st.auto);
      setSlots(st.slots || "09:00,14:00,19:00");
      setPreparedCount(st.prepared ?? 0);
      if (st.lastPost) setLastPost(st.lastPost);
      if (!st.usingTables && st.today) {
        setUsage(Array.from({ length: st.today.count ?? 0 }, (_, i) => ({
          id: `mem-${i}`, day, topic: null, cost_usd: (st.today.spent ?? 0) / Math.max(1, st.today.count ?? 1), words: 0, ok: true, created_at: new Date().toISOString(),
        })) as Usage[]);
      }
      setRuns(Object.entries(st.slotRuns || {}).map(([slot, status]) => ({ slot, status: String(status), note: null })));
    } catch { setEngineDown(true); }

    const settingsRow = await safe(() => supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle());
    if (settingsRow) { setTablesOk(true); setAuto(!!(settingsRow as { auto_publish: boolean }).auto_publish); setSlots((settingsRow as { slots: string }).slots || "09:00,14:00,19:00"); }

    const [u, t, r, lp, pc, ev, po, rp] = await Promise.all([
      safe(() => supabase.from("blog_engine_usage").select("*").order("created_at", { ascending: false }).limit(500)),
      safe(() => supabase.from("blog_topics").select("*").eq("status", "queued").order("priority", { ascending: false }).order("created_at").limit(20)),
      safe(() => supabase.from("blog_slot_runs").select("slot,status,note").eq("day", day)),
      safe(() => supabase.from("blog_posts").select("title,published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(1).maybeSingle()),
      safe(() => supabase.from("blog_prepared").select("id").eq("status", "ready")),
      safe(() => supabase.from("blog_events").select("post_id,type,seconds,cta_label,session_id").order("created_at", { ascending: false }).limit(5000)),
      safe(() => supabase.from("blog_posts").select("id,title,views_count").eq("is_published", true).order("published_at", { ascending: false }).limit(100)),
      safe(() => supabase.from("blog_posts").select("id,title,slug,created_at,is_published").order("created_at", { ascending: false }).limit(12)),
    ]);
    if (u) setUsage(u as Usage[]);
    if (t) setQueue(t as Topic[]);
    if (r && (r as SlotRun[]).length) setRuns(r as SlotRun[]);
    if (lp) setLastPost(lp as { title: string; published_at: string });
    if (pc) setPreparedCount((pc as { id: string }[]).length);
    setEvents((ev as Ev[]) ?? []);
    setPosts((po as Post[]) ?? []);
    setRecentPosts((rp as { id: string; title: string; slug: string; created_at: string; is_published: boolean }[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ENGINE = (import.meta.env.VITE_BLOG_ENGINE_URL || "").replace(/\/$/, "");
  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    if (action === "queue") {
      const { error } = await supabase.from("blog_topics").insert({
        query: String(extra.query || "").trim(),
        research_note: (extra.research_note as string) || null,
        category: (extra.category as string) || null,
        source: "feed", priority: (extra.priority as number) ?? 100,
      });
      if (error) throw error;
      return { ok: true };
    }
    if (!ENGINE) throw new Error("Set VITE_BLOG_ENGINE_URL to your Render service URL");
    const { data: { session } } = await supabase.auth.getSession();
    const path = action === "generate" ? "/api/generate" : "/api/run-slot";
    const res = await fetch(`${ENGINE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify(extra),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error || `Engine error (${res.status})`);
    return data;
  };

  const saveSchedule = async (nextAuto: boolean, nextSlots = slots) => {
    setAuto(nextAuto);
    try {
      await saveEngineSettings({ auto: nextAuto, slots: nextSlots });
      toast.success(nextAuto ? "Auto-posting on" : "Auto-posting off");
    } catch (e) { toast.error((e as Error).message); }
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

  const slotList = slots.split(",").map((x) => x.trim()).filter(Boolean).sort();
  const nowD = new Date(nowTick);
  const hhmmNow = nowD.toISOString().slice(11, 16);
  const upcoming = slotList.find((t) => t > hhmmNow);
  const target = new Date(nowD);
  if (upcoming) { const [h, m] = upcoming.split(":").map(Number); target.setUTCHours(h, m, 0, 0); }
  else if (slotList.length) { const [h, m] = slotList[0].split(":").map(Number); target.setUTCDate(target.getUTCDate() + 1); target.setUTCHours(h, m, 0, 0); }
  const msLeft = slotList.length ? target.getTime() - nowTick : 0;
  const secs = Math.max(0, Math.floor(msLeft / 1000));
  const countdown = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m ${secs % 60}s`;
  const nextAt = upcoming || slotList[0] || "—";
  const ago = (iso: string) => {
    const m = Math.floor((nowTick - new Date(iso).getTime()) / 60000);
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  };

  if (loading) return <div className={`flex items-center gap-2 text-sm ${muted}`}><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      {engineDown && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          <b>Engine not reachable.</b> Deploy the <code>server/</code> folder as a Render <b>Web Service</b> and set
          <code className="mx-1">VITE_BLOG_ENGINE_URL</code> on the site to its URL.
        </div>
      )}
      {!engineDown && !tablesOk && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 text-blue-900 p-3 text-sm">
          <b>Running on built-in defaults.</b> Posting works now. The topic queue, slot history and reader analytics
          switch on once the database migrations in <code>supabase/migrations/</code> are applied.
        </div>
      )}
      {/* Live status */}
      <div className={card}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className={`text-[11px] uppercase tracking-wide ${muted}`}>Next post</p>
            {auto ? (
              <>
                <p className="text-2xl font-bold tabular-nums">{countdown}</p>
                <p className={`text-xs ${muted}`}>at {nextAt} UTC{upcoming ? "" : " (tomorrow)"}</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-[hsl(0,0%,55%)]">Paused</p>
                <p className={`text-xs ${muted}`}>auto-posting is off</p>
              </>
            )}
          </div>
          <div className="text-right">
            <p className={`text-[11px] uppercase tracking-wide ${muted}`}>Next draft</p>
            <p className={`text-sm font-semibold ${preparedCount > 0 ? "text-green-600" : "text-amber-600"}`}>
              {preparedCount > 0 ? "Written & waiting" : "Writes at slot time"}
            </p>
            <p className={`text-[11px] ${muted} mt-2`}>
              {lastPost ? <>Last posted {ago(lastPost.published_at)} — <span className="text-black">{lastPost.title}</span></> : "Nothing posted yet"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {slotList.map((t) => {
            const run = runs.find((r) => r.slot === t);
            const done = run?.status === "posted";
            return (
              <span key={t} className={`text-[11px] px-2 py-0.5 rounded border ${done ? "border-green-300 text-green-700 bg-green-50" : run ? "border-amber-300 text-amber-700 bg-amber-50" : t === nextAt && auto ? "border-black/30 text-black bg-[hsl(0,0%,96%)]" : "border-[hsl(0,0%,88%)] " + muted}`}>
                {t} {done ? "· posted" : run ? `· ${run.status}` : t <= hhmmNow ? "· missed" : "· scheduled"}
              </span>
            );
          })}
        </div>
      </div>
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

      {/* Reader analytics */}
      {(() => {
        const views = events.filter((e) => e.type === "view").length;
        const reads = events.filter((e) => e.type === "read");
        const clicks = events.filter((e) => e.type === "cta_click");
        const uniques = new Set(events.map((e) => e.session_id).filter(Boolean)).size;
        const avgRead = reads.length ? Math.round(reads.reduce((s2, r) => s2 + (r.seconds || 0), 0) / reads.length) : 0;
        const ctr = views ? (clicks.length / views) * 100 : 0;
        const byPost = posts.map((p) => {
          const pe = events.filter((e) => e.post_id === p.id);
          const pr = pe.filter((e) => e.type === "read");
          return {
            title: p.title,
            views: pe.filter((e) => e.type === "view").length || p.views_count || 0,
            avg: pr.length ? Math.round(pr.reduce((s2, r) => s2 + (r.seconds || 0), 0) / pr.length) : 0,
            clicks: pe.filter((e) => e.type === "cta_click").length,
          };
        }).sort((a, b) => b.views - a.views).slice(0, 5);
        const mmss = (sec: number) => `${Math.floor(sec / 60)}m ${sec % 60}s`;

        return (
          <div className={card}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={15} /> Reader analytics</h2>
            {posts.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-lg border border-dashed border-[hsl(0,0%,85%)] bg-[hsl(0,0%,98%)]">
                <BarChart3 size={26} className="mx-auto mb-2 text-[hsl(0,0%,65%)]" />
                <p className="text-sm font-medium">Analytics start with your first post</p>
                <p className={`text-xs ${muted} mt-1 max-w-md mx-auto`}>
                  Once a blog is live we track every view, how long people actually read, and every CTA click —
                  so you can see which posts bring traders in. Nothing is broken; there's just nothing to measure yet.
                </p>
                <div className="flex justify-center gap-6 mt-4 opacity-40">
                  {["Views", "Read time", "CTA clicks"].map((l) => (
                    <div key={l} className="text-center"><p className="text-lg font-bold">—</p><p className="text-[10px] uppercase tracking-wide">{l}</p></div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { icon: <Eye size={14} />, label: "Views", value: views.toLocaleString() },
                    { icon: <Eye size={14} />, label: "Readers", value: uniques.toLocaleString() },
                    { icon: <Clock size={14} />, label: "Avg read", value: mmss(avgRead) },
                    { icon: <MousePointerClick size={14} />, label: "CTA clicks", value: clicks.length.toLocaleString() },
                    { icon: <MousePointerClick size={14} />, label: "CTR", value: `${ctr.toFixed(1)}%` },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border border-[hsl(0,0%,90%)] p-3">
                      <p className={`text-[10px] uppercase tracking-wide flex items-center gap-1 ${muted}`}>{m.icon}{m.label}</p>
                      <p className="text-xl font-bold mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>
                {views === 0 && <p className={`text-xs ${muted} mt-3`}>Posts are live — reader stats will appear as people land on them.</p>}
                {byPost.length > 0 && views > 0 && (
                  <div className="mt-4">
                    <p className={`text-[11px] uppercase tracking-wide ${muted} mb-1`}>Top posts</p>
                    <div className="divide-y divide-[hsl(0,0%,92%)] text-sm">
                      {byPost.map((b) => (
                        <div key={b.title} className="flex items-center justify-between gap-3 py-2">
                          <span className="truncate flex-1">{b.title}</span>
                          <span className="text-xs tabular-nums">{b.views} views</span>
                          <span className="text-xs tabular-nums">{mmss(b.avg)}</span>
                          <span className="text-xs tabular-nums">{b.clicks} clicks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Recent */}
      <div className={card}>
        <h2 className="text-sm font-semibold mb-2">Recent generations</h2>
        {usage.length > 0 ? (
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
        ) : recentPosts.length > 0 ? (
          <div className="divide-y divide-[hsl(0,0%,92%)] text-sm">
            {recentPosts.slice(0, 10).map((p) => (
              <a key={p.id} href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 py-2 hover:bg-[hsl(0,0%,98%)] rounded px-1 -mx-1">
                <span className="truncate flex-1">{p.title}</span>
                <span className={`text-xs ${muted} whitespace-nowrap`}>{new Date(p.created_at).toLocaleString()}</span>
                <span className={`text-xs ${p.is_published ? "text-green-600" : muted}`}>{p.is_published ? "published" : "draft"}</span>
              </a>
            ))}
          </div>
        ) : <p className={`text-sm ${muted}`}>Nothing yet.</p>}
      </div>
    </div>
  );
};

export default BlogAutoPilot;
