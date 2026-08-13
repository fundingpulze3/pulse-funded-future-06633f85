import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MongoClient } from "npm:mongodb@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "account_status_history",
  "affiliate_referrals",
  "ai_conversations",
  "ai_messages",
  "announcement_bar",
  "blog_ai_conversations",
  "blog_ai_messages",
  "blog_engine_usage",
  "blog_events",
  "blog_posts",
  "blog_prepared",
  "blog_settings",
  "blog_slot_runs",
  "blog_topics",
  "certificate_templates",
  "certificates",
  "challenge_purchases",
  "challenges",
  "coupons",
  "ctrader_credentials",
  "ctrader_snapshots",
  "ctrader_sync_state",
  "email_campaign_events",
  "email_campaigns",
  "email_group_contacts",
  "email_groups",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "help_article_feedback",
  "help_articles",
  "help_collections",
  "help_support_tickets",
  "knowledge_base",
  "kyc_submissions",
  "page_content",
  "page_visits",
  "payout_requests",
  "processed_gmail_ids",
  "profiles",
  "saved_email_templates",
  "support_ticket_messages",
  "suppressed_emails",
  "trading_credentials",
  "user_certificates",
  "user_roles",
];

// Indexes created after the copy so the app queries stay fast.
const INDEXES: Record<string, string[]> = {
  profiles: ["user_id", "email"],
  challenge_purchases: ["user_id", "challenge_id", "payment_status"],
  trading_credentials: ["assigned_to", "challenge_id", "purchase_id"],
  user_roles: ["user_id"],
  ai_messages: ["conversation_id"],
  blog_ai_messages: ["conversation_id"],
  support_ticket_messages: ["ticket_id"],
  ctrader_snapshots: ["credential_id", "captured_at"],
  ctrader_sync_state: ["credential_id"],
  blog_posts: ["slug", "is_published"],
  help_articles: ["slug", "is_published", "collection_id"],
  page_content: ["page_key"],
  kyc_submissions: ["user_id"],
  payout_requests: ["user_id"],
  user_certificates: ["user_id"],
  account_status_history: ["user_id"],
};


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const results: Record<string, { count: number; status: string }> = {};
  let mongoClient: MongoClient | null = null;

  // ?verify=1 -> just report the row count of every collection in MongoDB
  if (new URL(req.url).searchParams.get("verify")) {
    try {
      const uri = Deno.env.get("MONGODB_URI");
      if (!uri) throw new Error("MONGODB_URI not configured");
      mongoClient = new MongoClient(uri);
      await mongoClient.connect();
      const db = mongoClient.db();
      const counts: Record<string, number> = {};
      for (const t of TABLES) counts[t] = await db.collection(t).countDocuments({});
      return new Response(JSON.stringify({ counts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      if (mongoClient) { await mongoClient.close(); mongoClient = null; }
    }
  }


  try {
    const MONGODB_URI = Deno.env.get("MONGODB_URI");
    if (!MONGODB_URI) throw new Error("MONGODB_URI not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(); // uses DB from URI

    for (const table of TABLES) {
      try {
        // Fetch all rows (paginate for large tables)
        let allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = supabaseAdmin
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1);

          // Exclude administrator role from sync
          if (table === "user_roles") {
            query = query.neq("role", "administrator");
          }

          const { data, error } = await query;

          if (error) throw error;
          if (!data || data.length === 0) break;
          allRows = allRows.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        const collection = db.collection(table);
        if (allRows.length > 0) {
          await collection.deleteMany({}); // clear existing
          // Keep the Postgres primary key as the Mongo _id so relations survive.
          await collection.insertMany(allRows.map((r) => ({ ...r, _id: r.id ?? undefined })));
        }
        for (const field of INDEXES[table] ?? []) {
          try { await collection.createIndex({ [field]: 1 }); } catch { /* ignore */ }
        }

        results[table] = { count: allRows.length, status: "ok" };
      } catch (e) {
        results[table] = { count: 0, status: `error: ${(e as Error).message}` };
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (mongoClient) await mongoClient.close();
  }
});
