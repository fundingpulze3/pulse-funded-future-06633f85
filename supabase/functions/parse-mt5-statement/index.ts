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
    const certificateType = formData.get("certificate_type") as string || "phase1_passed";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read file content as text (for HTML) or extract text from content
    const fileText = await file.text();
    
    // Parse the MT5 statement (HTML format - MT5 exports statements as HTML)
    const parsed = parseMT5Statement(fileText);

    if (!parsed.accountNumber) {
      return new Response(
        JSON.stringify({ error: "Could not extract account number from statement", parsed }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the trading credential with this account number
    const { data: credential } = await adminClient
      .from("trading_credentials")
      .select("*, challenge_purchases(*, challenges(name, account_size))")
      .eq("mt5_login", parsed.accountNumber)
      .eq("is_assigned", true)
      .single();

    if (!credential) {
      return new Response(
        JSON.stringify({ 
          error: "No assigned credential found for account " + parsed.accountNumber,
          parsed,
          suggestion: "Make sure this MT5 login is assigned to a user in the credentials manager"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload the original file to storage
    const fileName = `${parsed.accountNumber}_${certificateType}_${Date.now()}.html`;
    await adminClient.storage
      .from("mt5-statements")
      .upload(fileName, file, { contentType: file.type, upsert: true });

    const { data: urlData } = adminClient.storage
      .from("mt5-statements")
      .getPublicUrl(fileName);

    // Determine title based on certificate type
    const titleMap: Record<string, string> = {
      phase1_passed: "Phase 1 Challenge Passed",
      funded: "Funded Account Certificate",
      payout: `Payout Certificate`,
    };

    // Create user certificate
    const { data: cert, error: certError } = await adminClient
      .from("user_certificates")
      .insert({
        user_id: credential.assigned_to,
        purchase_id: credential.purchase_id,
        credential_id: credential.id,
        certificate_type: certificateType,
        account_number: parsed.accountNumber,
        stats: parsed,
        pdf_url: urlData?.publicUrl || null,
        title: titleMap[certificateType] || "Certificate",
        description: `Account #${parsed.accountNumber} - ${parsed.name || "Trader"}`,
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
        parsed,
        assignedTo: credential.assigned_to,
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
 * Parse MT5 HTML statement to extract key trading stats.
 * MT5 exports account statements as HTML tables.
 */
function parseMT5Statement(html: string): Record<string, any> {
  const result: Record<string, any> = {};

  // Extract account number - MT5 uses patterns like "Account: 12345678" or "Login: 12345678"
  const accountPatterns = [
    /Account\s*[:#]?\s*(\d{4,})/i,
    /Login\s*[:#]?\s*(\d{4,})/i,
    /account\s*=\s*["']?(\d{4,})/i,
    /(\d{6,10})/,  // fallback: first 6-10 digit number
  ];
  
  for (const pattern of accountPatterns) {
    const match = html.match(pattern);
    if (match) {
      result.accountNumber = match[1];
      break;
    }
  }

  // Extract name
  const nameMatch = html.match(/Name\s*[:#]?\s*([^<\r\n]+)/i);
  if (nameMatch) result.name = nameMatch[1].trim();

  // Extract balance
  const balanceMatch = html.match(/Balance\s*[:#]?\s*([\d\s,.]+)/i);
  if (balanceMatch) result.balance = parseFloat(balanceMatch[1].replace(/[\s,]/g, ""));

  // Extract equity
  const equityMatch = html.match(/Equity\s*[:#]?\s*([\d\s,.]+)/i);
  if (equityMatch) result.equity = parseFloat(equityMatch[1].replace(/[\s,]/g, ""));

  // Extract profit
  const profitMatch = html.match(/Profit\s*[:#]?\s*([-\d\s,.]+)/i);
  if (profitMatch) result.profit = parseFloat(profitMatch[1].replace(/[\s,]/g, ""));

  // Extract deposit
  const depositMatch = html.match(/Deposit\s*[:#]?\s*([\d\s,.]+)/i);
  if (depositMatch) result.deposit = parseFloat(depositMatch[1].replace(/[\s,]/g, ""));

  // Extract total trades
  const tradesMatch = html.match(/Total\s*Trades?\s*[:#]?\s*(\d+)/i);
  if (tradesMatch) result.totalTrades = parseInt(tradesMatch[1]);

  // Extract profit trades
  const profitTradesMatch = html.match(/Profit\s*Trades?\s*[:#]?\s*(\d+)/i);
  if (profitTradesMatch) result.profitTrades = parseInt(profitTradesMatch[1]);

  // Extract loss trades
  const lossTradesMatch = html.match(/Loss\s*Trades?\s*[:#]?\s*(\d+)/i);
  if (lossTradesMatch) result.lossTrades = parseInt(lossTradesMatch[1]);

  // Extract gross profit
  const grossProfitMatch = html.match(/Gross\s*Profit\s*[:#]?\s*([\d\s,.]+)/i);
  if (grossProfitMatch) result.grossProfit = parseFloat(grossProfitMatch[1].replace(/[\s,]/g, ""));

  // Extract gross loss
  const grossLossMatch = html.match(/Gross\s*Loss\s*[:#]?\s*([-\d\s,.]+)/i);
  if (grossLossMatch) result.grossLoss = parseFloat(grossLossMatch[1].replace(/[\s,]/g, ""));

  // Extract max drawdown
  const drawdownMatch = html.match(/(?:Max(?:imal)?\s*)?Drawdown\s*[:#]?\s*([\d\s,.]+)/i);
  if (drawdownMatch) result.maxDrawdown = parseFloat(drawdownMatch[1].replace(/[\s,]/g, ""));

  // Extract profit factor
  const pfMatch = html.match(/Profit\s*Factor\s*[:#]?\s*([\d.,]+)/i);
  if (pfMatch) result.profitFactor = parseFloat(pfMatch[1].replace(",", "."));

  // Extract server
  const serverMatch = html.match(/Server\s*[:#]?\s*([^<\r\n]+)/i);
  if (serverMatch) result.server = serverMatch[1].trim();

  // Extract currency
  const currencyMatch = html.match(/Currency\s*[:#]?\s*(\w{3})/i);
  if (currencyMatch) result.currency = currencyMatch[1];

  // Extract leverage
  const leverageMatch = html.match(/Leverage\s*[:#]?\s*(1:\d+)/i);
  if (leverageMatch) result.leverage = leverageMatch[1];

  return result;
}
