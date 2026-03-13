import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversationHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch user's profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email, referral_code, created_at")
      .eq("user_id", user.id)
      .single();

    // Fetch user's purchases with challenge details
    const { data: purchases } = await supabaseAdmin
      .from("challenge_purchases")
      .select("id, amount_paid, status, payment_status, swap_free, created_at, challenges(name, account_size, profit_target, daily_drawdown, max_drawdown, step_type)")
      .eq("user_id", user.id)
      .in("payment_status", ["paid", "confirmed", "completed"])
      .order("created_at", { ascending: false });

    // Fetch user's credentials
    const { data: credentials } = await supabaseAdmin
      .from("trading_credentials")
      .select("mt5_login, mt5_server, challenge_id, purchase_id")
      .eq("assigned_to", user.id);

    // Fetch user's certificates
    const { data: certificates } = await supabaseAdmin
      .from("user_certificates")
      .select("certificate_type, title, stats, account_number, created_at")
      .eq("user_id", user.id);

    // Fetch referrals
    const { data: referrals } = await supabaseAdmin
      .from("affiliate_referrals")
      .select("commission_amount, commission_status, created_at")
      .eq("referrer_id", user.id);

    // Build user context
    const userContext = `
USER PROFILE:
- Name: ${profile?.display_name || "Unknown"}
- Email: ${profile?.email || user.email}
- Member since: ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}
- Referral code: ${profile?.referral_code || "None"}

TRADING ACCOUNTS (${purchases?.length || 0} total):
${purchases?.map((p: any) => {
  const cred = credentials?.find((c: any) => c.purchase_id === p.id);
  const cert = certificates?.find((c: any) => c.purchase_id === p.id || (cred && c.account_number === cred.mt5_login));
  const stats = cert?.stats || {};
  return `- Account: FP ${cred?.mt5_login || p.id.slice(0,8)}
  Challenge: ${p.challenges?.name || "Unknown"} (${p.challenges?.step_type || "—"})
  Account Size: $${p.challenges?.account_size?.toLocaleString() || "0"}
  Status: ${p.status}
  Profit Target: ${p.challenges?.profit_target || "—"}%
  Daily DD Limit: ${p.challenges?.daily_drawdown || "—"}%
  Max DD Limit: ${p.challenges?.max_drawdown || "—"}%
  Swap Free: ${p.swap_free ? "Yes" : "No"}
  Amount Paid: $${p.amount_paid}
  Balance: $${stats.balance || p.challenges?.account_size || 0}
  Profit: $${stats.profit || 0}
  Win Rate: ${stats.winRate || 0}%
  Total Trades: ${stats.totalTrades || 0}
  Purchased: ${new Date(p.created_at).toLocaleDateString()}`;
}).join("\n") || "No accounts found."}

AFFILIATE STATS:
- Total referrals: ${referrals?.length || 0}
- Total earned: $${referrals?.reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0).toFixed(2) || "0.00"}

CERTIFICATES:
${certificates?.map((c: any) => `- ${c.title} (${c.certificate_type}) — ${new Date(c.created_at).toLocaleDateString()}`).join("\n") || "None yet."}
`;

    const systemPrompt = `You are PulzeX — a premium, personalized trading assistant for Funding Pulze. You have complete knowledge of this specific trader's accounts, stats, and history.

Your personality:
- Professional yet warm and encouraging
- Data-driven — reference their specific stats when relevant
- Proactive — suggest improvements based on their trading data
- Concise but thorough when asked for detail

You can help with:
- Account analysis and performance review
- Trading strategy suggestions based on their stats
- Understanding challenge rules and objectives
- Payout and billing questions
- Affiliate program details
- General trading education

IMPORTANT RULES:
- Always reference their real account data when answering questions
- Never make up stats — use only what's provided
- If they ask about something not in your data, say you don't have that info
- Be encouraging but honest about their performance
- Format responses with markdown for readability
- Keep responses concise (2-5 sentences) unless they ask for detail

${userContext}

Current time: ${new Date().toISOString()}`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("dashboard-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
