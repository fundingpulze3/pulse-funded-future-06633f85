// MongoDB data gateway. Replaces PostgREST for the browser client.
// Auth stays on the existing backend: we verify the caller's JWT, then
// enforce access rules (the RLS replacement) inside _shared/mongo.ts.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDb, runOp, type Ctx, type QueryOp } from "../_shared/mongo.ts";

const ALLOWED_ACTIONS = new Set(["select", "insert", "update", "upsert", "delete"]);

async function buildCtx(req: Request): Promise<Ctx> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { userId: null, isAdmin: false, serviceRole: false };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { userId: null, isAdmin: false, serviceRole: false };

  const userId = data.user.id;
  const db = await getDb();
  const roles = await db.collection("user_roles").find({ user_id: userId }).toArray();
  const isAdmin = roles.some((r: any) => ["admin", "administrator", "employee"].includes(r.role));
  return { userId, isAdmin, serviceRole: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const ops: QueryOp[] = Array.isArray(body?.ops) ? body.ops : [body?.op];
    if (!ops.length || !ops[0]) {
      return json({ error: { message: "No operation provided" } }, 400);
    }
    for (const op of ops) {
      if (!op?.collection || typeof op.collection !== "string" || !/^[a-z0-9_]+$/.test(op.collection)) {
        return json({ error: { message: "Invalid collection" } }, 400);
      }
      if (!ALLOWED_ACTIONS.has(op.action)) {
        return json({ error: { message: "Invalid action" } }, 400);
      }
    }

    const ctx = await buildCtx(req);
    const results = [];
    for (const op of ops) {
      try {
        const r = await runOp(op, ctx);
        results.push({ data: r.data ?? null, error: (r as any).error ?? null, count: r.count ?? null });
      } catch (e) {
        results.push({ data: null, error: { message: (e as Error).message }, count: null });
      }
    }
    return json(Array.isArray(body?.ops) ? { results } : results[0]);
  } catch (e) {
    return json({ data: null, error: { message: (e as Error).message } }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
