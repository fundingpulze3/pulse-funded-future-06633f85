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
    console.log(`[parse-mt5] File received: ${file.name}, size: ${fileText.length} chars`);
    
    // Check if JSON report exists
    const hasJsonReport = fileText.includes("window.__report");
    console.log(`[parse-mt5] Has window.__report: ${hasJsonReport}`);
    
    const parsed = parseMT5Statement(fileText);
    console.log(`[parse-mt5] Parsed account: ${parsed.accountNumber}, balance: ${parsed.balance}, deposit: ${parsed.deposit}, profit: ${parsed.profit}`);

    if (!parsed.accountNumber) {
      console.error(`[parse-mt5] FAILED: Could not extract account number. Keys found: ${Object.keys(parsed).join(", ")}`);
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

    // Always store latest stats for dashboard display regardless of pass/fail status
    await storeLatestStats(adminClient, credential, parsed);

    // If profit target not yet reached → IN PROGRESS, not failed
    if (!evaluation.targetReached) {

      return new Response(
        JSON.stringify({
          success: true,
          evaluation,
          parsed,
          status: "in_progress",
          statsSaved: true,
          message: `Dashboard updated ✓ — Account in progress. Profit: ${evaluation.profitPercent?.toFixed(2)}% / Target: ${evaluation.details.profitTarget}. Balance: $${parsed.balance?.toLocaleString() || "N/A"}. No drawdown breach.`,
          violations: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASSED: target reached + no breach ───
    // Look up purchase to get the step_type & current status (1-step skips phase 2)
    const { data: purchaseRow } = await adminClient
      .from("challenge_purchases")
      .select("id, status, user_id")
      .eq("id", credential.purchase_id)
      .maybeSingle();
    const isOneStep = (challenge.step_type || "").toLowerCase().includes("one");

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
    let nextPhaseStatus: string | null = null; // status to move purchase to
    let issueNewCredential = false;            // whether to swap MT5 creds for next phase

    if (!existingTypes.includes("phase1_passed")) {
      certificateType = "phase1_passed";
      title = "Phase 1 Challenge Passed ✅";
      description = `Account #${parsed.accountNumber} passed Phase 1 — Profit: $${evaluation.profitAmount?.toFixed(2) || "N/A"} (${evaluation.profitPercent?.toFixed(2) || "N/A"}%)`;
      // Mark account "under review" — admin manually pushes to next phase from the panel.
      // 1-step → awaiting funded review; 2-step → awaiting phase 2 review.
      nextPhaseStatus = "phase1_passed";
      issueNewCredential = false;
    } else if (!existingTypes.includes("phase2_passed") && !isOneStep) {
      certificateType = "phase2_passed";
      title = "Phase 2 Verification Passed ✅";
      description = `Account #${parsed.accountNumber} passed Phase 2 — Profit: $${evaluation.profitAmount?.toFixed(2) || "N/A"} (${evaluation.profitPercent?.toFixed(2) || "N/A"}%)`;
      nextPhaseStatus = "phase2_passed";
      issueNewCredential = false;
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

    // Fetch user profile for certificate name
    const { data: userProfile } = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("user_id", credential.assigned_to)
      .maybeSingle();
    const userName = userProfile?.display_name || "Trader";

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
        stats: { ...parsed, evaluation, userName },
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

    // ─── PHASE PROGRESSION: move purchase to next phase + issue new MT5 credentials ───
    let newCredential: any = null;
    if (nextPhaseStatus && purchaseRow) {
      const oldStatus = purchaseRow.status;

      // 1. Update purchase status
      await adminClient
        .from("challenge_purchases")
        .update({ status: nextPhaseStatus })
        .eq("id", purchaseRow.id);

      // 2. Log status change
      await adminClient.from("account_status_history").insert({
        purchase_id: purchaseRow.id,
        user_id: purchaseRow.user_id,
        old_status: oldStatus,
        new_status: nextPhaseStatus,
        changed_by: null,
        note: `Auto-marked under review by MT5 statement upload (${certificateType}). Awaiting admin push.`,
      });
      // NOTE: credential assignment is now handled manually by admin via "Push to Phase 2 / Funded" button.
    }

    // Send email notification for the certificate type
    try {
      const emailTypeMap: Record<string, string> = {
        phase1_passed: "phase1_passed",
        phase2_passed: "phase2_passed",
        payout: "payout_received",
      };
      const emailType = emailTypeMap[certificateType];
      if (emailType) {
        const emailData: Record<string, any> = { accountNumber: parsed.accountNumber };
        if (emailType === "phase1_passed" || emailType === "phase2_passed") {
          emailData.profit = `$${evaluation.profitAmount?.toFixed(2) || "0"}`;
          emailData.profitPercent = `${evaluation.profitPercent?.toFixed(2) || "0"}%`;
        }
        if (emailType === "payout_received") {
          const payoutCount = existingTypes.filter(t => t === "payout").length + 1;
          emailData.payoutAmount = `$${((evaluation.profitAmount || 0) * 0.9).toFixed(2)}`;
          emailData.payoutNumber = String(payoutCount);
        }
        await sendEmailNotification(adminClient, supabaseUrl, credential.assigned_to, emailType, emailData);
      }
    } catch (e) { console.error("Failed to send certificate email:", e); }

    // Send credentials email if a new MT5 account was just issued
    if (newCredential) {
      try {
        await sendEmailNotification(adminClient, supabaseUrl, purchaseRow!.user_id, "credentials", {
          mt5Login: newCredential.mt5_login,
          mt5Password: newCredential.mt5_password,
          mt5Server: newCredential.mt5_server || "MEXAtlantic-Demo",
          challengeName: challenge.name,
          accountSize: `$${Number(challenge.account_size).toLocaleString()}`,
        });
      } catch (e) { console.error("Failed to send credentials email:", e); }
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificate: cert,
        evaluation,
        parsed,
        certificateType,
        nextPhaseStatus,
        newCredential: newCredential ? { mt5_login: newCredential.mt5_login, server: newCredential.mt5_server } : null,
        message: `${title} issued for account #${parsed.accountNumber}${newCredential ? ` — New ${nextPhaseStatus} account FP ${newCredential.mt5_login} issued ✓` : nextPhaseStatus ? ` — Status moved to ${nextPhaseStatus} (no spare credentials in pool!)` : ""}`,
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
  // Only accept JSON-embedded MT5 reports (window.__report) to avoid partial/corrupt parses.
  const jsonMatch = html.match(/window\.__report\s*=\s*\n?([\s\S]*?);\s*<\/script>/);

  if (!jsonMatch) {
    console.warn("[parse-mt5] Unsupported statement format: missing window.__report");
    return {};
  }

  try {
    const report = JSON.parse(jsonMatch[1]);
    const parsed = parseJsonReport(report);

    // Minimal sanity checks — account number + numeric balance are required.
    // Balance chart may be empty for some report formats, so don't require it.
    const ok =
      !!parsed.accountNumber &&
      typeof parsed.balance === "number" &&
      typeof parsed.deposit === "number";

    if (!ok) {
      console.error("[parse-mt5] Parsed report failed sanity checks", {
        accountNumber: parsed.accountNumber,
        balance: parsed.balance,
        deposit: parsed.deposit,
      });
      return {};
    }

    return parsed;
  } catch (e) {
    console.error("[parse-mt5] Failed to parse JSON report", e);
    return {};
  }
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
  result.digits = acc.digits ?? 2;

  // Balance & equity
  const bal = report.balance || {};
  result.balance = bal.balance ?? 0;
  result.equity = bal.equity ?? 0;
  result.balancePeriod = bal.period ?? 3600;

  // Balance/equity chart data
  if (bal.chart && Array.isArray(bal.chart)) {
    result.balanceChart = bal.chart.map((p: any) => ({
      timestamp: p.x,
      balance: p.y?.[0] ?? 0,
      equity: p.y?.[1] ?? p.y?.[0] ?? 0,
    }));
  }

  // Monthly P&L table
  if (bal.table) {
    result.monthlyPL = bal.table;
  }

  // Summary
  const summary = report.summary || {};
  result.gain = summary.gain ?? 0;
  result.gainPercent = (summary.gain ?? 0) * 100;
  result.activity = summary.activity ?? 0;
  result.deposit = Array.isArray(summary.deposit) ? summary.deposit[0] : summary.deposit ?? 0;
  result.depositCount = Array.isArray(summary.deposit) ? summary.deposit[1] : 1;
  result.withdrawal = Array.isArray(summary.withdrawal) ? summary.withdrawal[0] : 0;
  result.withdrawalCount = Array.isArray(summary.withdrawal) ? summary.withdrawal[1] : 0;
  result.dividendAmount = summary.dividend ?? 0;
  result.correctionAmount = summary.correction ?? 0;
  result.creditAmount = summary.credit ?? 0;

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
  result.growthPeriod = growth.period ?? 3600;

  // Growth chart (growth % line)
  if (growth.chart && Array.isArray(growth.chart) && growth.chart[0]) {
    result.growthChart = growth.chart[0].map((p: any) => ({
      timestamp: p.x,
      growth: (p.y?.[0] ?? 0) * 100,
    }));
  }
  // Drawdown chart from growth
  if (growth.chart && Array.isArray(growth.chart) && growth.chart[1]) {
    result.drawdownChart = growth.chart[1].map((p: any) => ({
      timestamp: p.x,
      drawdown: (p.y?.[0] ?? 0) * 100,
    }));
  }
  // Growth monthly table
  if (growth.table) {
    result.growthTable = growth.table;
  }

  // Dividend section
  const dividend = report.dividend || {};
  result.dividend = dividend.dividend ?? 0;
  result.correction = dividend.correction ?? 0;
  result.credit = dividend.credit ?? 0;
  if (dividend.chart) result.dividendChart = dividend.chart;
  if (dividend.table) result.dividendTable = dividend.table;

  // Profit totals
  const profitTotal = report.profitTotal || {};
  result.grossProfit = profitTotal.profit_gross ?? profitTotal.profit ?? 0;
  result.grossLoss = profitTotal.loss_gross ?? profitTotal.loss ?? 0;
  result.profitDividend = profitTotal.profit_dividend ?? 0;
  result.swapTotal = profitTotal.profit_swap ?? 0;
  result.commissionTotal = profitTotal.loss_commission ?? 0;

  // Profit money time series
  if (report.profitMoney) {
    result.profitMoney = {
      period: report.profitMoney.period,
      profit: report.profitMoney.profit,
      loss: report.profitMoney.loss,
      table: report.profitMoney.table,
    };
  }

  // Profit deals time series
  if (report.profitDeals) {
    result.profitDeals = {
      period: report.profitDeals.period,
      profit: report.profitDeals.profit,
      loss: report.profitDeals.loss,
      table: report.profitDeals.table,
    };
  }

  // Profit by day chart
  if (report.profitDaily?.chart) {
    result.profitByDay = report.profitDaily.chart;
  }

  // Profit by type (robot/manual/signals)
  if (report.profitType) {
    result.profitType = report.profitType;
  }

  // Long/Short breakdown
  const ls = report.longShortTotal || {};
  result.longTrades = ls.long ?? 0;
  result.shortTrades = ls.short ?? 0;
  result.totalTrades = (ls.long ?? 0) + (ls.short ?? 0);

  // Long/Short time series
  if (report.longShort) {
    result.longShortTimeSeries = {
      period: report.longShort.period,
      long: report.longShort.long,
      short: report.longShort.short,
      all: report.longShort.all,
    };
  }

  // Long/Short daily chart
  if (report.longShortDaily?.chart) {
    result.longShortDaily = report.longShortDaily.chart;
  }

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
  if (lsi.average_pl_percent) {
    result.avgPLPercentLong = (lsi.average_pl_percent[0] ?? 0) * 100;
    result.avgPLPercentShort = (lsi.average_pl_percent[1] ?? 0) * 100;
  }
  if (lsi.commissions) {
    result.commissionsLong = lsi.commissions[0] ?? 0;
    result.commissionsShort = lsi.commissions[1] ?? 0;
  }
  if (lsi.average_profit) {
    result.avgProfitLong = lsi.average_profit[0] ?? 0;
    result.avgProfitShort = lsi.average_profit[1] ?? 0;
  }
  if (lsi.average_profit_percent) {
    result.avgProfitPercentLong = (lsi.average_profit_percent[0] ?? 0) * 100;
    result.avgProfitPercentShort = (lsi.average_profit_percent[1] ?? 0) * 100;
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

  // Symbol money time series
  if (report.symbolMoney) {
    result.symbolMoney = report.symbolMoney;
  }

  // Symbol deals time series
  if (report.symbolDeals) {
    result.symbolDeals = report.symbolDeals;
  }

  // Symbol indicators (profit factor, netto profit, fees per symbol)
  if (report.symbolIndicators) {
    result.symbolIndicators = report.symbolIndicators;
  }

  // Symbols breakdown — format is [["SYMBOL", profit, trades], ...]
  if (report.symbolsTotal?.total) {
    result.symbols = report.symbolsTotal.total.map((s: any) => {
      if (Array.isArray(s)) {
        return { name: s[0], profit: s[1] ?? 0, trades: s[2] ?? 0 };
      }
      return { name: s.x, profit: s.y?.[0] ?? 0, trades: s.y?.[1] ?? 0 };
    });
  }

  // Symbol types (Currency, CFD, etc.)
  if (report.symbolTypes?.type) {
    result.symbolTypes = report.symbolTypes.type.map((t: any) => {
      if (Array.isArray(t)) return { type: t[0], count: t[1] ?? 0 };
      return t;
    });
  }

  // Drawdown detail chart
  if (report.drawdown?.chart) {
    result.drawdownDetailChart = report.drawdown.chart;
  }
  if (report.drawdown) {
    result.drawdownMax = (report.drawdown.drawdown ?? 0) * 100;
    result.drawdownDepositLoad = (report.drawdown.deposit_load ?? 0) * 100;
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

  // MFE/MAE percent
  if (report.risksMfeMaePercent) {
    result.risksMfeMaePercent = {
      maxAvgProfitRatio: report.risksMfeMaePercent.max_avg_profit_ratio ?? 0,
      maxAvgMfeRatio: report.risksMfeMaePercent.max_avg_mfe_ratio ?? 0,
      minAvgLossRatio: report.risksMfeMaePercent.min_avg_loss_ratio ?? 0,
      minAvgMaeRatio: report.risksMfeMaePercent.min_avg_mae_ratio ?? 0,
      chart: report.risksMfeMaePercent.chart,
    };
  }

  // MFE/MAE money
  if (report.risksMfeMaeMoney) {
    result.risksMfeMaeMoney = {
      maxAvgProfit: report.risksMfeMaeMoney.max_avg_profit ?? 0,
      maxAvgMfe: report.risksMfeMaeMoney.max_avg_mfe ?? 0,
      minAvgLoss: report.risksMfeMaeMoney.min_avg_loss ?? 0,
      minAvgMae: report.risksMfeMaeMoney.min_avg_mae ?? 0,
      chart: report.risksMfeMaeMoney.chart,
    };
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

/**
 * Send email notification to a user via the transactional email edge function
 */
async function sendEmailNotification(adminClient: any, supabaseUrl: string, userId: string, type: string, data: Record<string, any>) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type, data, recipientUserId: userId }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error(`Email notification failed (${type}):`, err);
  } else {
    console.log(`Email notification sent: ${type} to user ${userId}`);
  }
}
