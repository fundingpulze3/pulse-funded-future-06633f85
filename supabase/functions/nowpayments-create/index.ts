import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NOWPAYMENTS_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!NOWPAYMENTS_KEY) {
      return new Response(JSON.stringify({ error: "NOWPayments API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ─── CREATE INVOICE ───
    if (action === "create_invoice") {
      const { amount, currency, description, purchaseId, orderId, siteUrl } = body;

      // Use the actual site URL passed from frontend, fallback to known domain
      const baseUrl = siteUrl || "https://fundingpulze.com";

      const invoiceRes = await fetch(`${NOWPAYMENTS_API}/invoice`, {
        method: "POST",
        headers: {
          "x-api-key": NOWPAYMENTS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: currency || "usd",
          order_id: orderId || purchaseId,
          order_description: description || "Trading Challenge Purchase",
          ipn_callback_url: `${supabaseUrl}/functions/v1/nowpayments-webhook`,
          success_url: `${baseUrl}/dashboard`,
          cancel_url: `${baseUrl}/checkout`,
        }),
      });

      const invoice = await invoiceRes.json();
      if (!invoiceRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create invoice", details: invoice }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        invoiceUrl: invoice.invoice_url,
        invoiceId: invoice.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CHECK PAYMENT STATUS ───
    if (action === "check_status") {
      const { paymentId } = body;

      const statusRes = await fetch(`${NOWPAYMENTS_API}/payment/${paymentId}`, {
        headers: { "x-api-key": NOWPAYMENTS_KEY },
      });

      const statusData = await statusRes.json();
      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET AVAILABLE CURRENCIES ───
    if (action === "currencies") {
      const currRes = await fetch(`${NOWPAYMENTS_API}/currencies`, {
        headers: { "x-api-key": NOWPAYMENTS_KEY },
      });
      const currData = await currRes.json();
      return new Response(JSON.stringify(currData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
