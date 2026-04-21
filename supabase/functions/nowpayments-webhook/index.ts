import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-nowpayments-sig",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
    if (!IPN_SECRET) {
      console.error("NOWPAYMENTS_IPN_SECRET not configured");
      return new Response("Not configured", { status: 500 });
    }

    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // Verify IPN signature using IPN Secret (NOT API key)
    const receivedSig = req.headers.get("x-nowpayments-sig");
    if (receivedSig) {
      const sortedBody = JSON.stringify(sortObject(body));
      const hmac = createHmac("sha512", IPN_SECRET);
      hmac.update(sortedBody);
      const expectedSig = hmac.digest("hex");
      
      if (receivedSig !== expectedSig) {
        console.error("Invalid IPN signature. Received:", receivedSig, "Expected:", expectedSig);
        return new Response("Invalid signature", { status: 403 });
      }
      console.log("IPN signature verified successfully");
    } else {
      console.warn("No IPN signature header received - processing anyway");
    }

    const { payment_status, order_id } = body;

    if (!order_id) {
      return new Response("No order_id", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // payment_status: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    if (payment_status === "finished" || payment_status === "confirmed") {
      // Confirm the purchase
      const { data: purchase } = await adminClient
        .from("challenge_purchases")
        .select("id, challenge_id, user_id, payment_status")
        .eq("id", order_id)
        .single();

      if (!purchase || purchase.payment_status === "completed") {
        return new Response("OK", { status: 200 });
      }

      await adminClient
        .from("challenge_purchases")
        .update({ payment_status: "completed", status: "active" })
        .eq("id", order_id);

      // Auto-assign credentials — only NEVER-used credentials (assigned_to/at NULL)
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
            assigned_to: purchase.user_id,
            assigned_at: new Date().toISOString(),
            purchase_id: order_id,
          })
          .eq("id", cred.id);

        // Send credentials email
        const { data: credDetails } = await adminClient.from("trading_credentials").select("mt5_login, mt5_password, mt5_server").eq("id", cred.id).single();
        const { data: challengeInfo } = await adminClient.from("challenges").select("name, account_size").eq("id", purchase.challenge_id).single();
        
        if (credDetails) {
          const credEmailData = { mt5Login: credDetails.mt5_login, mt5Password: credDetails.mt5_password, mt5Server: credDetails.mt5_server, challengeName: challengeInfo?.name || "", accountSize: challengeInfo ? `$${challengeInfo.account_size / 1000}K` : "" };
          try {
            // Send to customer
            await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ type: "credentials", recipientUserId: purchase.user_id, data: credEmailData }),
            });
            // CC to admin
            await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ type: "credentials", data: credEmailData, recipientOverride: "notchiragc@gmail.com" }),
            });
          } catch (e) { console.error("Cred email failed:", e); }
        }
      }

      // Send purchase confirmation
      try {
        const { data: ci } = await adminClient.from("challenges").select("name, account_size").eq("id", purchase.challenge_id).single();
        await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "purchase_confirmation",
            recipientUserId: purchase.user_id,
            data: { challengeName: ci?.name || "", accountSize: ci ? `$${ci.account_size / 1000}K` : "", amountPaid: `$${body.price_amount || "0"}` },
          }),
        });
      } catch (e) { console.error("Purchase email failed:", e); }
    } else if (payment_status === "failed" || payment_status === "expired") {
      await adminClient
        .from("challenge_purchases")
        .update({ payment_status: "failed" })
        .eq("id", order_id);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(String(err), { status: 500 });
  }
});

function sortObject(obj: any): any {
  return Object.keys(obj).sort().reduce((result: any, key: string) => {
    result[key] = obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])
      ? sortObject(obj[key])
      : obj[key];
    return result;
  }, {});
}
