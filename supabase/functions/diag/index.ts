import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getDb } from "../_shared/mongo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = new URL(req.url).searchParams.get("k");
  if (key !== Deno.env.get("CTRADER_INGEST_SECRET")) {
    return new Response("no", { status: 401, headers: corsHeaders });
  }
  const db = await getDb();
  const out: Record<string, unknown> = {};

  // 1. does a sorted paged read of page_visits work at all?
  for (const [name, run] of Object.entries({
    visits_sorted_page: async () =>
      (await db.collection("page_visits").find({}).sort({ created_at: -1 }).skip(0).limit(1000).toArray()).length,
    visits_deep_page: async () =>
      (await db.collection("page_visits").find({}).sort({ created_at: -1 }).skip(20000).limit(1000).toArray()).length,
    purchases_sorted: async () =>
      (await db.collection("challenge_purchases").find({}).sort({ created_at: -1 }).toArray()).length,
    profiles_sorted_page: async () =>
      (await db.collection("profiles").find({}).sort({ created_at: -1 }).skip(4000).limit(1000).toArray()).length,
  })) {
    const t = Date.now();
    try {
      out[name] = { ok: await run(), ms: Date.now() - t };
    } catch (e) {
      out[name] = { error: (e as Error).message, ms: Date.now() - t };
    }
  }

  out.user_roles = await db.collection("user_roles").find({}).toArray();
  out.counts = {
    profiles: await db.collection("profiles").countDocuments(),
    purchases: await db.collection("challenge_purchases").countDocuments(),
  };

  // 2. indexes present?
  out.indexes = {
    page_visits: await db.collection("page_visits").indexes(),
    challenge_purchases: await db.collection("challenge_purchases").indexes(),
    profiles: await db.collection("profiles").indexes(),
  };

  return new Response(JSON.stringify(out, null, 1), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
