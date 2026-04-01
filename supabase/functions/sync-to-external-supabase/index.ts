import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Order matters: parent tables first, then children (FK dependencies)
const TABLES = [
  // Independent tables (no FK dependencies)
  { name: "profiles", pk: "id" },
  { name: "challenges", pk: "id" },
  { name: "certificates", pk: "id" },
  { name: "certificate_templates", pk: "id" },
  { name: "kyc_submissions", pk: "id" },
  { name: "user_roles", pk: "id" },
  { name: "blog_posts", pk: "id" },
  { name: "help_collections", pk: "id" },
  { name: "knowledge_base", pk: "id" },
  { name: "page_content", pk: "id" },
  { name: "page_visits", pk: "id" },
  { name: "coupons", pk: "id" },
  { name: "email_send_log", pk: "id" },
  { name: "email_send_state", pk: "id" },
  { name: "email_unsubscribe_tokens", pk: "id" },
  { name: "suppressed_emails", pk: "id" },
  { name: "processed_gmail_ids", pk: "id" },
  { name: "ai_conversations", pk: "id" },
  { name: "blog_ai_conversations", pk: "id" },
  // Depends on challenges
  { name: "challenge_purchases", pk: "id" },
  // Depends on challenges + challenge_purchases
  { name: "trading_credentials", pk: "id" },
  // Depends on challenge_purchases
  { name: "payout_requests", pk: "id" },
  { name: "account_status_history", pk: "id" },
  { name: "affiliate_referrals", pk: "id" },
  // Depends on trading_credentials + challenge_purchases
  { name: "user_certificates", pk: "id" },
  // Depends on help_collections
  { name: "help_articles", pk: "id" },
  // Depends on help_articles
  { name: "help_article_feedback", pk: "id" },
  { name: "help_support_tickets", pk: "id" },
  // Depends on help_support_tickets
  { name: "support_ticket_messages", pk: "id" },
  // Depends on ai_conversations / blog_ai_conversations
  { name: "ai_messages", pk: "id" },
  { name: "blog_ai_messages", pk: "id" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sourceUrl = Deno.env.get("SUPABASE_URL");
    const sourceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!sourceUrl || !sourceKey) throw new Error("Source Supabase credentials missing");
    if (!extUrl || !extKey) throw new Error("External Supabase credentials missing");

    const source = createClient(sourceUrl, sourceKey);
    const target = createClient(extUrl, extKey);

    const results: { table: string; rows: number; status: string }[] = [];
    const errors: string[] = [];

    for (const table of TABLES) {
      try {
        // Fetch all rows (handle pagination for large tables)
        let allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = source
            .from(table.name)
            .select("*")
            .range(from, from + pageSize - 1);

          // Exclude administrator role from sync to protect master account
          if (table.name === "user_roles") {
            query = query.neq("role", "administrator");
          }

          const { data, error } = await query;

          if (error) throw error;
          if (!data || data.length === 0) break;

          allRows = allRows.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        if (allRows.length === 0) {
          results.push({ table: table.name, rows: 0, status: "empty" });
          continue;
        }

        // Upsert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < allRows.length; i += batchSize) {
          const batch = allRows.slice(i, i + batchSize);
          const { error: upsertError } = await target
            .from(table.name)
            .upsert(batch, { onConflict: table.pk, ignoreDuplicates: false });

          if (upsertError) {
            throw upsertError;
          }
        }

        results.push({ table: table.name, rows: allRows.length, status: "synced" });
      } catch (tableError: any) {
        const msg = `${table.name}: ${tableError.message || tableError}`;
        errors.push(msg);
        results.push({ table: table.name, rows: 0, status: "error" });
      }
    }

    const totalRows = results.reduce((sum, r) => sum + r.rows, 0);

    console.log(`Sync complete: ${totalRows} rows across ${results.filter(r => r.status === "synced").length} tables. Errors: ${errors.length}`);
    if (errors.length > 0) console.error("Sync errors:", errors);

    return new Response(
      JSON.stringify({
        success: true,
        synced_at: new Date().toISOString(),
        total_rows: totalRows,
        tables: results,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Sync failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
