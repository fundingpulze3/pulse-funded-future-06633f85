import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient.rpc("get_user_role", { _user_id: user.id });
    if (!roleData || !["administrator", "admin"].includes(roleData)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileText = await file.text();
    const parsed = parseMT5Statement(fileText);

    if (!parsed.accountNumber) {
      return new Response(
        JSON.stringify({ error: "Could not extract account number from statement", parsed }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the credential + challenge info
    const { data: credential } = await adminClient
      .from("trading_credentials")
      .select("id, assigned_to, purchase_id, challenge_id")
      .eq("mt5_login", parsed.accountNumber)
      .eq("is_assigned", true)
      .single();

    if (!credential) {
      return new Response(
        JSON.stringify({
          error: `No assigned credential found for account ${parsed.accountNumber}`,
          parsed,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the challenge rules
    const { data: challenge } = await adminClient
      .from("challenges")
      .select("name, account_size, profit_target, daily_drawdown, max_drawdown, min_trading_days, step_type")
      .eq("id", credential.challenge_id)
      .single();

    if (!challenge) {
      return new Response(
        JSON.stringify({ error: "Challenge not found for this credential", parsed }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── AUTO-EVALUATE ───
    const evaluation = evaluateAccount(parsed, challenge);

    // Check existing certificates for this user + credential to determine stage
    const { data: existingCerts } = await adminClient
      .from("user_certificates")
      .select("certificate_type")
      .eq("credential_id", credential.id)
      .eq("user_id", credential.assigned_to)
      .order("created_at", { ascending: true });

    const existingTypes = (existingCerts || []).map(c => c.certificate_type);
    
    // Determine what certificate to issue based on progression
    let certificateType: string;
    let title: string;
    let description: string;

    if (!existingTypes.includes("phase1_passed") && evaluation.passedPhase1) {
      certificateType = "phase1_passed";
      title = "Phase 1 Challenge Passed ✅";
      description = `Account #${parsed.accountNumber} passed Phase 1 — Profit: $${evaluation.profitAmount?.toFixed(2) || "N/A"} (${evaluation.profitPercent?.toFixed(2) || "N/A"}%)`;
    } else if (existingTypes.includes("phase1_passed") && !existingTypes.includes("funded") && evaluation.passedPhase1) {
      certificateType = "funded";
      title = "Funded Account Certificate 🏆";
      description = `Account #${parsed.accountNumber} is now Funded — Balance: $${parsed.balance?.toLocaleString() || "N/A"}`;
    } else if (existingTypes.includes("funded") && evaluation.profitAmount && evaluation.profitAmount > 0) {
      const payoutCount = existingTypes.filter(t => t === "payout").length + 1;
      certificateType = "payout";
      title = `Payout #${payoutCount} Certificate 💰`;
      description = `Account #${parsed.accountNumber} — Payout: $${evaluation.profitAmount?.toFixed(2) || "N/A"}`;
    } else {
      // Account didn't pass or already has this cert
      return new Response(
        JSON.stringify({
          success: false,
          evaluation,
          parsed,
          message: evaluation.passedPhase1
            ? "Certificate already exists for this stage. Upload a newer statement for the next stage."
            : "Account has NOT passed. See evaluation details.",
          violations: evaluation.violations,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload original file
    const fileName = `${parsed.accountNumber}_${certificateType}_${Date.now()}.html`;
    await adminClient.storage.from("mt5-statements").upload(fileName, file, { contentType: file.type, upsert: true });

    // Create certificate
    const { data: cert, error: certError } = await adminClient
      .from("user_certificates")
      .insert({
        user_id: credential.assigned_to,
        purchase_id: credential.purchase_id,
        credential_id: credential.id,
        certificate_type: certificateType,
        account_number: parsed.accountNumber,
        stats: { ...parsed, evaluation },
        title,
        description,
      })
      .select()
      .single();

    if (certError) {
      return new Response(JSON.stringify({ error: certError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificate: cert,
        evaluation,
        parsed,
        certificateType,
        message: `${title} issued for account #${parsed.accountNumber}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Evaluate if the account passed based on challenge rules
 */
function evaluateAccount(
  stats: Record<string, any>,
  challenge: Record<string, any>
): {
  passedPhase1: boolean;
  profitAmount: number | null;
  profitPercent: number | null;
  violations: string[];
  details: Record<string, any>;
} {
  const violations: string[] = [];
  const details: Record<string, any> = {};

  const deposit = stats.deposit || stats.balance || 0;
  const profit = stats.profit || 0;
  const balance = stats.balance || 0;
  const profitAmount = profit > 0 ? profit : (balance > deposit ? balance - deposit : 0);
  const profitPercent = deposit > 0 ? (profitAmount / deposit) * 100 : 0;

  // Parse profit target (e.g., "8%" or "10%")
  const targetMatch = challenge.profit_target?.match(/([\d.]+)/);
  const targetPercent = targetMatch ? parseFloat(targetMatch[1]) : 8;
  details.profitTarget = `${targetPercent}%`;
  details.actualProfit = `${profitPercent.toFixed(2)}%`;

  if (profitPercent < targetPercent) {
    violations.push(`Profit ${profitPercent.toFixed(2)}% below target ${targetPercent}%`);
  }

  // Parse max drawdown (e.g., "10%" or "12%")
  const maxDDMatch = challenge.max_drawdown?.match(/([\d.]+)/);
  const maxDDPercent = maxDDMatch ? parseFloat(maxDDMatch[1]) : 10;
  details.maxDrawdownLimit = `${maxDDPercent}%`;

  if (stats.maxDrawdown && deposit > 0) {
    const ddPercent = (stats.maxDrawdown / deposit) * 100;
    details.actualMaxDrawdown = `${ddPercent.toFixed(2)}%`;
    if (ddPercent > maxDDPercent) {
      violations.push(`Max drawdown ${ddPercent.toFixed(2)}% exceeded limit ${maxDDPercent}%`);
    }
  }

  // Parse daily drawdown (e.g., "5%")
  const dailyDDMatch = challenge.daily_drawdown?.match(/([\d.]+)/);
  const dailyDDPercent = dailyDDMatch ? parseFloat(dailyDDMatch[1]) : 5;
  details.dailyDrawdownLimit = `${dailyDDPercent}%`;

  // Parse min trading days (e.g., "5 days" or "3")
  const minDaysMatch = challenge.min_trading_days?.match(/(\d+)/);
  const minDays = minDaysMatch ? parseInt(minDaysMatch[1]) : 0;
  details.minTradingDays = minDays;

  if (stats.totalTrades != null && stats.totalTrades < minDays) {
    // Using total trades as a proxy if trading days not available
    details.note = "Using total trades as proxy for trading days";
  }

  return {
    passedPhase1: violations.length === 0 && profitAmount > 0,
    profitAmount,
    profitPercent,
    violations,
    details,
  };
}

/**
 * Parse MT5 HTML statement
 */
function parseMT5Statement(html: string): Record<string, any> {
  const result: Record<string, any> = {};

  const accountPatterns = [
    /Account\s*[:#]?\s*(\d{4,})/i,
    /Login\s*[:#]?\s*(\d{4,})/i,
    /account\s*=\s*["']?(\d{4,})/i,
    /(\d{6,10})/,
  ];
  for (const pattern of accountPatterns) {
    const match = html.match(pattern);
    if (match) { result.accountNumber = match[1]; break; }
  }

  const nameMatch = html.match(/Name\s*[:#]?\s*([^<\r\n]+)/i);
  if (nameMatch) result.name = nameMatch[1].trim();

  const balanceMatch = html.match(/Balance\s*[:#]?\s*([\d\s,.]+)/i);
  if (balanceMatch) result.balance = parseFloat(balanceMatch[1].replace(/[\s,]/g, ""));

  const equityMatch = html.match(/Equity\s*[:#]?\s*([\d\s,.]+)/i);
  if (equityMatch) result.equity = parseFloat(equityMatch[1].replace(/[\s,]/g, ""));

  const profitMatch = html.match(/Profit\s*[:#]?\s*([-\d\s,.]+)/i);
  if (profitMatch) result.profit = parseFloat(profitMatch[1].replace(/[\s,]/g, ""));

  const depositMatch = html.match(/Deposit\s*[:#]?\s*([\d\s,.]+)/i);
  if (depositMatch) result.deposit = parseFloat(depositMatch[1].replace(/[\s,]/g, ""));

  const tradesMatch = html.match(/Total\s*Trades?\s*[:#]?\s*(\d+)/i);
  if (tradesMatch) result.totalTrades = parseInt(tradesMatch[1]);

  const profitTradesMatch = html.match(/Profit\s*Trades?\s*[:#]?\s*(\d+)/i);
  if (profitTradesMatch) result.profitTrades = parseInt(profitTradesMatch[1]);

  const lossTradesMatch = html.match(/Loss\s*Trades?\s*[:#]?\s*(\d+)/i);
  if (lossTradesMatch) result.lossTrades = parseInt(lossTradesMatch[1]);

  const grossProfitMatch = html.match(/Gross\s*Profit\s*[:#]?\s*([\d\s,.]+)/i);
  if (grossProfitMatch) result.grossProfit = parseFloat(grossProfitMatch[1].replace(/[\s,]/g, ""));

  const grossLossMatch = html.match(/Gross\s*Loss\s*[:#]?\s*([-\d\s,.]+)/i);
  if (grossLossMatch) result.grossLoss = parseFloat(grossLossMatch[1].replace(/[\s,]/g, ""));

  const drawdownMatch = html.match(/(?:Max(?:imal)?\s*)?Drawdown\s*[:#]?\s*([\d\s,.]+)/i);
  if (drawdownMatch) result.maxDrawdown = parseFloat(drawdownMatch[1].replace(/[\s,]/g, ""));

  const pfMatch = html.match(/Profit\s*Factor\s*[:#]?\s*([\d.,]+)/i);
  if (pfMatch) result.profitFactor = parseFloat(pfMatch[1].replace(",", "."));

  const serverMatch = html.match(/Server\s*[:#]?\s*([^<\r\n]+)/i);
  if (serverMatch) result.server = serverMatch[1].trim();

  const currencyMatch = html.match(/Currency\s*[:#]?\s*(\w{3})/i);
  if (currencyMatch) result.currency = currencyMatch[1];

  const leverageMatch = html.match(/Leverage\s*[:#]?\s*(1:\d+)/i);
  if (leverageMatch) result.leverage = leverageMatch[1];

  return result;
}
