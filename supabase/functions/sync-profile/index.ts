// Keeps the MongoDB `profiles` collection in sync with auth signups.
// New signups are created by a Postgres trigger, which MongoDB never sees —
// this function mirrors them across (per-user on sign-in, or bulk for admins).
import { createClient } from "npm:@supabase/supabase-js@2";
import { MongoClient } from "npm:mongodb@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let mongo: MongoClient | null = null;
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const authUser = userData?.user;
    if (!authUser) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const uri = Deno.env.get("MONGODB_URI");
    if (!uri) throw new Error("MONGODB_URI not configured");
    mongo = new MongoClient(uri);
    await mongo.connect();
    const db = mongo.db();
    const profiles = db.collection("profiles");

    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    // ---- Bulk backfill (admins only) ----
    if (body?.backfill) {
      const { data: roleRows } = await admin
        .from("user_roles").select("role").eq("user_id", authUser.id);
      const isAdmin = (roleRows ?? []).some((r: any) =>
        ["admin", "administrator"].includes(r.role));
      if (!isAdmin) return json({ error: "Admin access required" }, 403);

      const existing = new Set(
        (await profiles.find({}, { projection: { user_id: 1 } }).toArray())
          .map((d: any) => d.user_id),
      );

      let from = 0;
      const pageSize = 1000;
      let inserted = 0;
      while (true) {
        const { data, error } = await admin
          .from("profiles").select("*").range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        const missing = data.filter((r: any) => !existing.has(r.user_id));
        if (missing.length) {
          await profiles.insertMany(missing.map((r: any) => ({ ...r, _id: r.id })));
          inserted += missing.length;
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return json({ ok: true, inserted });
    }

    // ---- Single user (self) ----
    const found = await profiles.findOne({ user_id: authUser.id });
    if (found) return json({ ok: true, created: false });

    const { data: pgProfile } = await admin
      .from("profiles").select("*").eq("user_id", authUser.id).maybeSingle();

    const doc = pgProfile
      ? { ...pgProfile, _id: pgProfile.id }
      : {
          _id: crypto.randomUUID(),
          id: crypto.randomUUID(),
          user_id: authUser.id,
          email: authUser.email ?? null,
          display_name:
            (authUser.user_metadata as any)?.full_name ||
            (authUser.user_metadata as any)?.display_name ||
            (authUser.email ?? "").split("@")[0],
          avatar_url: (authUser.user_metadata as any)?.avatar_url ?? null,
          referral_code: authUser.id.replace(/-/g, "").slice(0, 8),
          referred_by: null,
          created_at: authUser.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    if (!pgProfile) (doc as any).id = doc._id;

    await profiles.insertOne(doc as any);
    return json({ ok: true, created: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  } finally {
    if (mongo) await mongo.close();
  }
});
