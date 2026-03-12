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
    const NOWPAYMENTS_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!NOWPAYMENTS_KEY) {
      return new Response("Not configured", { status: 500 });
    }

    const body = await req.json();
    
    // Verify IPN signature
    const receivedSig = req.headers.get("x-nowpayments-sig");
    if (receivedSig) {
      const sortedBody = JSON.stringify(sortObject(body));
      const hmac = createHmac("sha512", NOWPAYMENTS_KEY);
      hmac.update(sortedBody);
      const expectedSig = hmac.digest("hex");
      
      if (receivedSig !== expectedSig) {
        console.error("Invalid IPN signature");
        return new Response("Invalid signature", { status: 403 });
      }
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

      if (!purchase || purchase.payment_status === "confirmed") {
        return new Response("OK", { status: 200 });
      }

      await adminClient
        .from("challenge_purchases")
        .update({ payment_status: "confirmed", status: "active" })
        .eq("id", order_id);

      // Auto-assign credentials
      const { data: cred } = await adminClient
        .from("trading_credentials")
        .select("id")
        .eq("challenge_id", purchase.challenge_id)
        .eq("is_assigned", false)
        .limit(1)
        .single();

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
      }
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
