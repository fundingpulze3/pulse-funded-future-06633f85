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
  for (const c of ["challenge_purchases", "page_visits", "user_roles", "profiles", "blog_posts", "blog_topics", "blog_slot_runs", "blog_settings", "blog_engine_usage"]) {
    out[c] = await db.collection(c).countDocuments({});
  }
  out.roles = await db.collection("user_roles").find({}).limit(20).toArray();
  out.recent_posts = await db.collection("blog_posts").find({}).sort({ created_at: -1 }).limit(5)
    .project({ title: 1, created_at: 1, is_published: 1, _id: 0 }).toArray();
  out.slot_runs = await db.collection("blog_slot_runs").find({}).sort({ created_at: -1 }).limit(10).toArray();
  out.settings = await db.collection("blog_settings").find({}).toArray();
  out.usage = await db.collection("blog_engine_usage").find({}).sort({ created_at: -1 }).limit(5).toArray();
  out.topics = await db.collection("blog_topics").find({}).sort({ created_at: -1 }).limit(5).toArray();
  return new Response(JSON.stringify(out, null, 1), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
