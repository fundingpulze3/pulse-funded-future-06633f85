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

    // If breached (drawdown violation) → FAIL immediately, no certificate
    if (evaluation.breached) {
      // Send breach email to user
      try {
        const isDailyBreach = evaluation.violations.some((v: string) => v.toLowerCase().includes("daily"));
        await sendEmailNotification(adminClient, supabaseUrl, credential.assigned_to, isDailyBreach ? "daily_dd_breach" : "max_dd_breach", {
          accountNumber: parsed.accountNumber,
          breachValue: isDailyBreach ? evaluation.details.actualDailyDrawdown : evaluation.details.actualMaxDrawdown,
          limit: isDailyBreach ? evaluation.details.dailyDrawdownLimit : evaluation.details.maxDrawdownLimit,
        });
      } catch (e) { console.error("Failed to send breach email:", e); }

      return new Response(
        JSON.stringify({
          success: false,
          evaluation,
          parsed,
          message: "Account BREACHED — drawdown limit exceeded. This account is failed.",
          violations: evaluation.violations,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If profit target not yet reached → IN PROGRESS, not failed
    if (!evaluation.targetReached) {
      // Still store the parsed stats for dashboard display even if in progress
      await storeLatestStats(adminClient, credential, parsed);

      return new Response(
        JSON.stringify({
          success: false,
          evaluation,
          parsed,
          status: "in_progress",
          message: `Account is still in progress. Current profit: ${evaluation.profitPercent?.toFixed(2)}% — Target: ${evaluation.details.profitTarget}. No drawdown breach detected. Keep trading!`,
          violations: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASSED: target reached + no breach ───
    const { data: existingCerts } = await adminClient
      .from("user_certificates")
      .select("certificate_type")
      .eq("credential_id", credential.id)
      .eq("user_id", credential.assigned_to)
      .order("created_at", { ascending: true });

    const existingTypes = (existingCerts || []).map(c => c.certificate_type);
    
    let certificateType: string;
    let title: string;
    let description: string;

    if (!existingTypes.includes("phase1_passed")) {
      certificateType = "phase1_passed";
      title = "Phase 1 Challenge Passed ✅";
      description = `Account #${parsed.accountNumber} passed Phase 1 — Profit: $${evaluation.profitAmount?.toFixed(2) || "N/A"} (${evaluation.profitPercent?.toFixed(2) || "N/A"}%)`;
    } else if (!existingTypes.includes("phase2_passed")) {
      certificateType = "phase2_passed";
      title = "Phase 2 Verification Passed ✅";
      description = `Account #${parsed.accountNumber} passed Phase 2 — Profit: $${evaluation.profitAmount?.toFixed(2) || "N/A"} (${evaluation.profitPercent?.toFixed(2) || "N/A"}%)`;
    } else if (!existingTypes.includes("funded")) {
      certificateType = "funded";
      title = "Funded Account Certificate 🏆";
      description = `Account #${parsed.accountNumber} is now Funded — Balance: $${parsed.balance?.toLocaleString() || "N/A"}`;
    } else if (existingTypes.includes("funded") && evaluation.profitAmount && evaluation.profitAmount > 0) {
      const payoutCount = existingTypes.filter(t => t === "payout").length + 1;
      certificateType = "payout";
      title = `Payout #${payoutCount} Certificate 💰`;
      description = `Account #${parsed.accountNumber} — Payout: $${evaluation.profitAmount?.toFixed(2) || "N/A"} (90% split)`;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          evaluation,
          parsed,
          message: "Certificate already exists for this stage. Upload a newer statement for the next stage.",
          violations: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload original file
    const fileName = `${parsed.accountNumber}_${certificateType}_${Date.now()}.html`;
    await adminClient.storage.from("mt5-statements").upload(fileName, file, { contentType: file.type, upsert: true });

    // Create certificate with rich stats
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
 * Store latest parsed stats to the most recent certificate for dashboard display
 */
async function storeLatestStats(adminClient: any, credential: any, parsed: Record<string, any>) {
  // Upsert a "latest_stats" type record so the dashboard always has fresh data
  const { data: existing } = await adminClient
    .from("user_certificates")
    .select("id")
    .eq("credential_id", credential.id)
    .eq("user_id", credential.assigned_to)
    .eq("certificate_type", "latest_stats")
    .single();

  if (existing) {
    await adminClient
      .from("user_certificates")
      .update({ stats: parsed, title: "Latest Trading Stats", description: `Account #${parsed.accountNumber} — Latest statement upload` })
      .eq("id", existing.id);
  } else {
    await adminClient
      .from("user_certificates")
      .insert({
        user_id: credential.assigned_to,
        purchase_id: credential.purchase_id,
        credential_id: credential.id,
        certificate_type: "latest_stats",
        account_number: parsed.accountNumber,
        stats: parsed,
        title: "Latest Trading Stats",
        description: `Account #${parsed.accountNumber} — Latest statement upload`,
      });
  }
}

/**
 * Evaluate account
 */
function evaluateAccount(
  stats: Record<string, any>,
  challenge: Record<string, any>
): {
  breached: boolean;
  targetReached: boolean;
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

  const targetMatch = challenge.profit_target?.match(/([\d.]+)/);
  const targetPercent = targetMatch ? parseFloat(targetMatch[1]) : 8;
  details.profitTarget = `${targetPercent}%`;
  details.actualProfit = `${profitPercent.toFixed(2)}%`;
  details.profitSplit = "90%";
  details.scalingUpTo = "$1,000,000";
  details.payoutTime = "24-48 hrs";

  const targetReached = profitPercent >= targetPercent;

  const maxDDMatch = challenge.max_drawdown?.match(/([\d.]+)/);
  const maxDDPercent = maxDDMatch ? parseFloat(maxDDMatch[1]) : 10;
  details.maxDrawdownLimit = `${maxDDPercent}%`;

  let breached = false;

  // Use drawdown from parsed JSON report if available
  const ddValue = stats.drawdownPercent ?? (stats.maxDrawdown && deposit > 0 ? (stats.maxDrawdown / deposit) * 100 : 0);
  if (ddValue > 0) {
    details.actualMaxDrawdown = `${ddValue.toFixed(2)}%`;
    if (ddValue > maxDDPercent) {
      violations.push(`Max overall drawdown ${ddValue.toFixed(2)}% exceeded limit ${maxDDPercent}%`);
      breached = true;
    }
  }

  const dailyDDMatch = challenge.daily_drawdown?.match(/([\d.]+)/);
  const dailyDDPercent = dailyDDMatch ? parseFloat(dailyDDMatch[1]) : 5;
  details.dailyDrawdownLimit = `${dailyDDPercent}%`;

  if (stats.dailyDrawdown && deposit > 0) {
    const dailyDD = (stats.dailyDrawdown / deposit) * 100;
    details.actualDailyDrawdown = `${dailyDD.toFixed(2)}%`;
    if (dailyDD > dailyDDPercent) {
      violations.push(`Daily drawdown ${dailyDD.toFixed(2)}% exceeded limit ${dailyDDPercent}%`);
      breached = true;
    }
  }

  details.minTradingDays = "No minimum (phases)";
  details.payoutMinDays = "7 days";
  details.timeLimit = "Unlimited";

  return { breached, targetReached, profitAmount, profitPercent, violations, details };
}

/**
 * Parse MT5 HTML statement — supports both JSON-embedded reports (window.__report)
 * and plain HTML table-based statements
 */
function parseMT5Statement(html: string): Record<string, any> {
  // Try JSON-embedded report first (modern MT5 reports)
  const jsonMatch = html.match(/window\.__report\s*=\s*\n?([\s\S]*?);\s*<\/script>/);
  if (jsonMatch) {
    try {
      const report = JSON.parse(jsonMatch[1]);
      return parseJsonReport(report);
    } catch (e) {
      console.error("Failed to parse JSON report, falling back to regex:", e);
    }
  }

  // Fallback: regex-based parsing for plain HTML statements
  return parseHtmlRegex(html);
}

/**
 * Parse the rich JSON report from window.__report
 */
function parseJsonReport(report: any): Record<string, any> {
  const result: Record<string, any> = {};

  // Account info
  const acc = report.account || {};
  result.accountNumber = String(acc.account || "");
  result.name = acc.name || "";
  result.currency = acc.currency || "USD";
  result.broker = acc.broker || "";
  result.accountType = acc.type || "";

  // Balance & equity
  const bal = report.balance || {};
  result.balance = bal.balance ?? 0;
  result.equity = bal.equity ?? 0;

  // Balance/equity chart data (time series for dashboard graph)
  if (bal.chart && Array.isArray(bal.chart)) {
    result.balanceChart = bal.chart.map((p: any) => ({
      timestamp: p.x,
      balance: p.y?.[0] ?? 0,
      equity: p.y?.[1] ?? p.y?.[0] ?? 0,
    }));
  }

  // Summary
  const summary = report.summary || {};
  result.gain = summary.gain ?? 0; // as decimal e.g. 0.00405 = 0.405%
  result.gainPercent = (summary.gain ?? 0) * 100;
  result.deposit = Array.isArray(summary.deposit) ? summary.deposit[0] : summary.deposit ?? 0;
  result.depositCount = Array.isArray(summary.deposit) ? summary.deposit[1] : 1;
  result.withdrawal = Array.isArray(summary.withdrawal) ? summary.withdrawal[0] : 0;
  result.withdrawalCount = Array.isArray(summary.withdrawal) ? summary.withdrawal[1] : 0;

  // Profit calculation
  result.profit = (result.balance || 0) - (result.deposit || 0);

  // Summary indicators
  const indicators = report.summaryIndicators || {};
  result.sharpeRatio = indicators.sharp_ratio ?? 0;
  result.profitFactor = indicators.profit_factor ?? 0;
  result.recoveryFactor = indicators.recovery_factor ?? 0;
  result.drawdownPercent = (indicators.drawdown ?? 0) * 100;
  result.depositLoad = (indicators.deposit_load ?? 0) * 100;
  result.tradesPerWeek = indicators.trades_per_week ?? 0;
  result.avgHoldTimeMinutes = indicators.hold_time ?? 0;

  // Growth data
  const growth = report.growth || {};
  result.growthPercent = (growth.growth ?? 0) * 100;
  result.maxDrawdownPercent = (growth.drawdown ?? 0) * 100;

  // Growth chart (for growth % line)
  if (growth.chart && Array.isArray(growth.chart) && growth.chart[0]) {
    result.growthChart = growth.chart[0].map((p: any) => ({
      timestamp: p.x,
      growth: (p.y?.[0] ?? 0) * 100,
    }));
  }
  // Drawdown chart
  if (growth.chart && Array.isArray(growth.chart) && growth.chart[1]) {
    result.drawdownChart = growth.chart[1].map((p: any) => ({
      timestamp: p.x,
      drawdown: (p.y?.[0] ?? 0) * 100,
    }));
  }

  // Profit totals
  const profitTotal = report.profitTotal || {};
  result.grossProfit = profitTotal.profit_gross ?? profitTotal.profit ?? 0;
  result.grossLoss = profitTotal.loss_gross ?? profitTotal.loss ?? 0;
  result.swapTotal = profitTotal.profit_swap ?? 0;
  result.commissionTotal = profitTotal.loss_commission ?? 0;

  // Profit by day chart
  if (report.profitDaily?.chart) {
    result.profitByDay = report.profitDaily.chart;
  }

  // Long/Short breakdown
  const ls = report.longShortTotal || {};
  result.longTrades = ls.long ?? 0;
  result.shortTrades = ls.short ?? 0;
  result.totalTrades = (ls.long ?? 0) + (ls.short ?? 0);

  // Long/Short detailed indicators
  const lsi = report.longShortIndicators || {};
  if (lsi.netto_pl) {
    result.longNetPL = lsi.netto_pl[0] ?? 0;
    result.shortNetPL = lsi.netto_pl[1] ?? 0;
  }
  if (lsi.average_pl) {
    result.avgPLLong = lsi.average_pl[0] ?? 0;
    result.avgPLShort = lsi.average_pl[1] ?? 0;
  }
  if (lsi.win_trades) {
    result.winTradesLong = lsi.win_trades[0] ?? 0;
    result.winTradesShort = lsi.win_trades[1] ?? 0;
  }
  if (lsi.trades) {
    result.tradesLong = lsi.trades[0] ?? 0;
    result.tradesShort = lsi.trades[1] ?? 0;
  }

  // Win rate calculation
  const totalTrades = result.totalTrades || 0;
  const winTrades = (result.winTradesLong || 0) + (result.winTradesShort || 0);
  result.winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

  // Trade types
  const tt = report.tradeTypeTotal || {};
  result.robotTrades = tt.robots ?? 0;
  result.manualTrades = tt.manual ?? 0;
  result.signalTrades = tt.signals ?? 0;

  // Symbols breakdown
  if (report.symbolsTotal?.total) {
    result.symbols = report.symbolsTotal.total.map((s: any) => ({
      name: s.x,
      profit: s.y?.[0] ?? 0,
      trades: s.y?.[1] ?? 0,
    }));
  }

  // Drawdown chart
  if (report.drawdown?.chart) {
    result.drawdownDetailChart = report.drawdown.chart;
  }

  // Risk indicators
  const ri = report.risksIndicators || {};
  if (ri.profit) {
    result.bestTrade = ri.profit[0] ?? 0;
    result.worstTrade = ri.profit[1] ?? 0;
  }
  if (ri.max_consecutive_trades) {
    result.maxConsecutiveWins = ri.max_consecutive_trades[0] ?? 0;
    result.maxConsecutiveLosses = ri.max_consecutive_trades[1] ?? 0;
  }
  if (ri.max_consecutive_profit) {
    result.maxConsecutiveProfit = ri.max_consecutive_profit[0] ?? 0;
    result.maxConsecutiveLoss = ri.max_consecutive_profit[1] ?? 0;
  }

  // Monthly P&L table
  if (bal.table) {
    result.monthlyPL = bal.table;
  }

  return result;
}

/**
 * Fallback regex-based parser for plain HTML statements
 */
function parseHtmlRegex(html: string): Record<string, any> {
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
