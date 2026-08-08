import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_SECRET = Deno.env.get("CTRADER_INGEST_SECRET") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!INGEST_SECRET) {
    return json({ error: "CTRADER_INGEST_SECRET is not configured on the server" }, 500);
  }

  const provided = req.headers.get("x-ingest-secret") ?? "";
  if (provided !== INGEST_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "");

  // ---- 1. Worker asks: which accounts should I scrape? ----
  if (action === "targets") {
    const { data, error } = await supabase
      .from("trading_credentials")
      .select("id, ctrader_token, mt5_login, assigned_to")
      .eq("platform", "ctrader")
      .eq("ctrader_is_active", true)
      .not("ctrader_token", "is", null);

    if (error) return json({ error: error.message }, 500);

    const targets = (data ?? [])
      .filter((r) => typeof r.ctrader_token === "string" && r.ctrader_token.length > 0)
      .map((r) => ({
        credential_id: r.id,
        token: r.ctrader_token as string,
        account_label: r.mt5_login,
        assigned: !!r.assigned_to,
      }));

    return json({ targets, count: targets.length });
  }

  // ---- 2. Worker reports a scrape result ----
  if (action === "ingest") {
    const credentialId = String(body.credential_id ?? "");
    if (!credentialId) return json({ error: "credential_id is required" }, 400);

    const ok = body.ok !== false;
    const errMsg = body.error ? String(body.error).slice(0, 500) : null;
    const m = (body.metrics ?? {}) as Record<string, unknown>;

    if (ok) {
      const row = {
        credential_id: credentialId,
        balance: num(m.balance),
        equity: num(m.equity),
        margin_used: num(m.margin_used),
        roi_percent: num(m.roi_percent),
        open_positions_count: int(m.open_positions_count),
        profit: num(m.profit),
        deposits: num(m.deposits),
        win_rate: num(m.win_rate),
        total_trades: int(m.total_trades),
        winning_trades: int(m.winning_trades),
        losing_trades: int(m.losing_trades),
        profit_factor: num(m.profit_factor),
        max_drawdown_percent: num(m.max_drawdown_percent),
        avg_win: num(m.avg_win),
        avg_loss: num(m.avg_loss),
        best_trade: num(m.best_trade),
        worst_trade: num(m.worst_trade),
        currency: m.currency ? String(m.currency).slice(0, 12) : null,
        account_name: m.account_name ? String(m.account_name).slice(0, 120) : null,
        period: m.period ? String(m.period).slice(0, 60) : null,
        raw: (body.raw ?? null) as Record<string, unknown> | null,
      };

      const hasAnyValue = Object.entries(row).some(
        ([k, v]) => !["credential_id", "raw"].includes(k) && v !== null,
      );

      if (!hasAnyValue) {
        await markState(supabase, credentialId, false, "scrape returned no readable metrics");
        return json({ stored: false, reason: "no readable metrics" });
      }

      const { error } = await supabase.from("ctrader_snapshots").insert(row);
      if (error) {
        await markState(supabase, credentialId, false, error.message);
        return json({ error: error.message }, 500);
      }

      await markState(supabase, credentialId, true, null);
      return json({ stored: true });
    }

    await markState(supabase, credentialId, false, errMsg ?? "unknown worker error");
    return json({ stored: false });
  }

  return json({ error: `unknown action: ${action}` }, 400);
});

async function markState(
  supabase: ReturnType<typeof createClient>,
  credentialId: string,
  success: boolean,
  errorMessage: string | null,
) {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("ctrader_sync_state")
    .select("consecutive_failures")
    .eq("credential_id", credentialId)
    .maybeSingle();

  const prevFailures = Number(existing?.consecutive_failures ?? 0);

  await supabase.from("ctrader_sync_state").upsert(
    {
      credential_id: credentialId,
      last_sync_at: now,
      last_success_at: success ? now : undefined,
      last_status: success ? "ok" : "error",
      last_error: success ? null : errorMessage,
      consecutive_failures: success ? 0 : prevFailures + 1,
    },
    { onConflict: "credential_id" },
  );
}
