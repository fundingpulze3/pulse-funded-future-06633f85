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
  "blog_ai_conversations",
  "blog_ai_messages",
  "blog_posts",
  "certificate_templates",
  "certificates",
  "challenge_purchases",
  "challenges",
  "coupons",
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
  "support_ticket_messages",
  "trading_credentials",
  "user_certificates",
  "user_roles",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const results: Record<string, { count: number; status: string }> = {};
  let mongoClient: MongoClient | null = null;

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

        if (allRows.length > 0) {
          const collection = db.collection(table);
          await collection.deleteMany({}); // clear existing
          await collection.insertMany(allRows);
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
