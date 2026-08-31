import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isRich = (s: unknown) =>
  s && typeof s === "object" &&
  (typeof (s as any).balance === "number" || typeof (s as any).equity === "number" || typeof (s as any).profit === "number");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    // 1. Auto-end any competition whose end date has passed but is still marked active.
    const nowIso = new Date().toISOString();
    const { data: expired, error: expiredErr } = await supabase
      .from("competitions")
      .select("id, name, ends_at, status")
      .eq("status", "active")
      .lt("ends_at", nowIso);

    if (expiredErr) throw expiredErr;

    if (expired && expired.length > 0) {
      const ids = expired.map((c: any) => c.id);
      const { error: updateErr } = await supabase
        .from("competitions")
        .update({ status: "ended" })
        .in("id", ids);
      if (updateErr) throw updateErr;
    }

    // 2. Refresh every participant's live stats — not just the currently logged-in
    //    user's own entries — so the leaderboard reflects everyone accurately.
    const [partsRes, purchRes, certsRes, profilesRes] = await Promise.all([
      supabase.from("competition_participants").select("*"),
      supabase.from("challenge_purchases").select("id, user_id, challenge_id, status, challenges(account_size)"),
      supabase.from("user_certificates").select("purchase_id, stats, created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, avatar_url"),
    ]);

    if (partsRes.error) throw partsRes.error;
    if (purchRes.error) throw purchRes.error;
    if (certsRes.error) throw certsRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const purchases = (purchRes.data ?? []) as any[];
    const certs = (certsRes.data ?? []) as any[];
    const profiles = (profilesRes.data ?? []) as any[];
    const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

    // Latest rich stats cert per purchase_id
    const latestCertByPurchase = new Map<string, any>();
    for (const c of certs) {
      if (!c.purchase_id || latestCertByPurchase.has(c.purchase_id)) continue;
      if (isRich(c.stats)) latestCertByPurchase.set(c.purchase_id, c);
    }

    const purchaseById = new Map(purchases.map((p) => [p.id, p]));

    let updated = 0;
    const participants = (partsRes.data ?? []) as any[];

    for (const entry of participants) {
      if (!entry.purchase_id) continue;
      const purchase = purchaseById.get(entry.purchase_id);
      if (!purchase) continue;

      const size = Number(purchase.challenges?.account_size ?? entry.account_size ?? 0);
      const cert = latestCertByPurchase.get(entry.purchase_id);
      const s = cert?.stats ?? {};
      const balance = Number(s.equity ?? s.balance ?? size);
      const profit = Number(s.profit ?? (balance - size));
      const gain = size > 0 ? (profit / size) * 100 : 0;
      const totalTrades = Number(s.totalTrades ?? entry.total_trades ?? 0);
      const winRate = Number(s.winRate ?? entry.win_rate ?? 0);
      const prof = profileByUser.get(entry.user_id);

      const patch = {
        display_name: prof?.display_name ?? entry.display_name,
        avatar_url: prof?.avatar_url ?? entry.avatar_url,
        account_size: size,
        gain_percentage: Number.isFinite(gain) ? gain : 0,
        profit: Number.isFinite(profit) ? profit : 0,
        total_trades: Number.isFinite(totalTrades) ? totalTrades : 0,
        win_rate: Number.isFinite(winRate) ? winRate : 0,
        updated_at: new Date().toISOString(),
      };

      // Skip write if nothing actually changed (cheap no-op guard)
      if (
        Math.abs((entry.gain_percentage ?? 0) - patch.gain_percentage) < 0.0001 &&
        Math.abs((entry.profit ?? 0) - patch.profit) < 0.01
      ) {
        continue;
      }

      const { error: patchErr } = await supabase
        .from("competition_participants")
        .update(patch)
        .eq("id", entry.id);
      if (!patchErr) updated++;
    }

    return json({
      ok: true,
      competitions_auto_ended: expired?.length ?? 0,
      participants_updated: updated,
      participants_checked: participants.length,
    });
  } catch (e: any) {
    console.error("sync-competitions failed", e);
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
