import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYPAL_CLIENT_ID = "BAAwk3bjO1bqRcrVytA9YTQC4dW6smqK2ocXDSrlDZn3pWNo2pNumzgqwzr8SwlEk7mZ4z9dpmxMCRDz5Q";
const PAYPAL_API = "https://api-m.paypal.com"; // Use https://api-m.sandbox.paypal.com for sandbox

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET_KEY");
    if (!PAYPAL_SECRET) {
      return new Response(JSON.stringify({ error: "PayPal secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
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
    const { action, orderData, purchaseId } = body;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get PayPal access token
    const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to get PayPal access token", details: tokenData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = tokenData.access_token;

    // ─── CREATE ORDER ───
    if (action === "create") {
      const { amount, currency, description } = orderData;

      const createRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: {
              currency_code: currency || "USD",
              value: String(amount),
            },
            description: description || "Trading Challenge Purchase",
          }],
        }),
      });

      const order = await createRes.json();
      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create PayPal order", details: order }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ orderID: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CAPTURE ORDER ───
    if (action === "capture") {
      const { orderID } = body;

      const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const captureData = await captureRes.json();
      if (!captureRes.ok || captureData.status !== "COMPLETED") {
        return new Response(JSON.stringify({ error: "Payment capture failed", details: captureData }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update the purchase to confirmed
      if (purchaseId) {
        // Confirm purchase
        await adminClient
          .from("challenge_purchases")
          .update({ payment_status: "completed", status: "active" })
          .eq("id", purchaseId)
          .eq("user_id", user.id);

        // Auto-assign credentials
        const { data: purchase } = await adminClient
          .from("challenge_purchases")
          .select("challenge_id")
          .eq("id", purchaseId)
          .single();

        if (purchase) {
          const { data: cred } = await adminClient
            .from("trading_credentials")
            .select("id")
            .eq("challenge_id", purchase.challenge_id)
            .eq("is_assigned", false)
            .is("assigned_to", null)
            .is("assigned_at", null)
            .limit(1)
            .maybeSingle();

          if (cred) {
            await adminClient
              .from("trading_credentials")
              .update({
                is_assigned: true,
                assigned_to: user.id,
                assigned_at: new Date().toISOString(),
                purchase_id: purchaseId,
              })
              .eq("id", cred.id);

            // Send credentials email
            const { data: credDetails } = await adminClient
              .from("trading_credentials")
              .select("mt5_login, mt5_password, mt5_server")
              .eq("id", cred.id)
              .single();

            const { data: challengeInfo } = await adminClient
              .from("challenges")
              .select("name, account_size")
              .eq("id", purchase.challenge_id)
              .single();

            if (credDetails) {
              const credEmailData = {
                mt5Login: credDetails.mt5_login,
                mt5Password: credDetails.mt5_password,
                mt5Server: credDetails.mt5_server,
                challengeName: challengeInfo?.name || "Trading Challenge",
                accountSize: challengeInfo ? `$${(challengeInfo.account_size / 1000)}K` : "",
              };
              try {
                // Send to customer
                await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "credentials", recipientUserId: user.id, data: credEmailData }),
                });
                // CC to admin
                await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "credentials", data: credEmailData, recipientOverride: "notchiragc@gmail.com" }),
                });
              } catch (e) { console.error("Failed to send credentials email:", e); }
            }
          }

          // Send purchase confirmation email
          try {
            const { data: challengeInfo2 } = await adminClient
              .from("challenges")
              .select("name, account_size")
              .eq("id", purchase.challenge_id)
              .single();

            await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "purchase_confirmation",
                recipientUserId: user.id,
                data: {
                  challengeName: challengeInfo2?.name || "Trading Challenge",
                  accountSize: challengeInfo2 ? `$${(challengeInfo2.account_size / 1000)}K` : "",
                  amountPaid: `$${captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || "0"}`,
                },
              }),
            });
          } catch (e) { console.error("Failed to send purchase confirmation email:", e); }
        }
      }

      return new Response(JSON.stringify({ success: true, captureData }), {
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
