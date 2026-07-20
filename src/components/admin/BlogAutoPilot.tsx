import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runAutoPublishNow } from "@/lib/blogEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";

type UsageRow = { id: string; day: string; model: string | null; topic: string | null; cost_usd: number; ok: boolean; created_at: string };

const card = "bg-white rounded-lg border border-[hsl(0,0%,88%)] p-4";
const labelCls = "text-xs font-medium text-[hsl(0,0%,35%)]";

const BlogAutoPilot = () => {
  const [brand, setBrand] = useState("");
  const [themes, setThemes] = useState("");
  const [auto, setAuto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [usage, setUsage] = useState({ count: 0, spent: 0 });
  const [recent, setRecent] = useState<UsageRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (data) { setBrand(data.brand_context || ""); setThemes(data.themes || ""); setAuto(!!data.auto_publish); }
    const day = new Date().toISOString().slice(0, 10);
    const { data: u } = await supabase.from("blog_engine_usage").select("cost_usd").eq("day", day).eq("ok", true);
    setUsage({ count: u?.length ?? 0, spent: (u ?? []).reduce((s: number, r: { cost_usd: number }) => s + Number(r.cost_usd || 0), 0) });
    const { data: r } = await supabase.from("blog_engine_usage").select("*").order("created_at", { ascending: false }).limit(10);
    setRecent((r as UsageRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("blog_settings")
      .update({ brand_context: brand, themes, auto_publish: auto, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  const runNow = async () => {
    setRunning(true);
    try { await runAutoPublishNow(); toast.success("Published a new post"); load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setRunning(false); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-[hsl(0,0%,45%)]"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-3 gap-3">
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wide text-[hsl(0,0%,45%)]">Posts today</p>
          <p className="text-2xl font-bold">{usage.count}<span className="text-sm font-normal text-[hsl(0,0%,55%)]">/10</span></p>
        </div>
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wide text-[hsl(0,0%,45%)]">Spend today</p>
          <p className="text-2xl font-bold">${usage.spent.toFixed(3)}<span className="text-sm font-normal text-[hsl(0,0%,55%)]">/$0.45</span></p>
        </div>
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wide text-[hsl(0,0%,45%)]">Auto-pilot</p>
          <p className="text-2xl font-bold">{auto ? "On" : "Off"}</p>
        </div>
      </div>

      <div className={card + " space-y-4"}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold flex items-center gap-2"><Sparkles size={16} /> Auto-pilot</p>
            <p className="text-xs text-[hsl(0,0%,45%)]">Writes and publishes one fresh post on the schedule, inside the daily caps.</p>
          </div>
          <Switch checked={auto} onCheckedChange={setAuto} />
        </div>

        <div>
          <Label className={labelCls}>Brand voice &amp; facts</Label>
          <Textarea rows={7} value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1 text-sm"
            placeholder={"Who you are, who you serve, tone, and any non-negotiables.\n\nExample: We are X, we help Y do Z. Audience: ... Tone: direct, practical. Never claim ..."} />
          <p className="text-[11px] text-[hsl(0,0%,45%)] mt-1">The engine writes strictly from this. Nothing is hardcoded.</p>
        </div>

        <div>
          <Label className={labelCls}>Topic themes</Label>
          <Input value={themes} onChange={(e) => setThemes(e.target.value)} className="mt-1 text-sm"
            placeholder="comma, separated, themes to draw topics from" />
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} size="sm" className="gap-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </Button>
          <Button onClick={runNow} disabled={running} size="sm" variant="outline" className="gap-1">
            {running ? <><Loader2 size={14} className="animate-spin" /> Writing…</> : <><Play size={14} /> Run once now</>}
          </Button>
        </div>
      </div>

      <div className={card}>
        <p className="font-semibold mb-2">Recent generations</p>
        {recent.length === 0 ? <p className="text-sm text-[hsl(0,0%,45%)]">Nothing yet.</p> : (
          <div className="text-sm divide-y divide-[hsl(0,0%,92%)]">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 gap-3">
                <span className="truncate flex-1">{r.topic || "—"}</span>
                <span className="text-[hsl(0,0%,45%)] text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</span>
                <span className="text-xs tabular-nums">${Number(r.cost_usd || 0).toFixed(3)}</span>
                <span className={`text-xs ${r.ok ? "text-green-600" : "text-red-600"}`}>{r.ok ? "ok" : "failed"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogAutoPilot;
