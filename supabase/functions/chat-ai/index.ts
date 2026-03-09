import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversationHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch KB articles for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: kbArticles } = await supabase
      .from("knowledge_base")
      .select("title, content, category")
      .eq("is_active", true)
      .order("sort_order");

    const kbContext = kbArticles && kbArticles.length > 0
      ? kbArticles.map((a: any) => `[${a.category}] ${a.title}: ${a.content}`).join("\n\n")
      : "";

    const systemPrompt = `You are PULZEX, the AI assistant for Funding Pulze — a premier prop trading firm. You are helpful, professional, warm, and concise.

Your role:
- Answer questions about Funding Pulze's services, challenges, payouts, and trading rules
- Help traders with account questions, challenge progress, and general trading inquiries
- Be empathetic and supportive — traders trust you with their career decisions
- Keep responses short (2-4 sentences) unless the user asks for detail
- Use emojis sparingly for warmth (1-2 max per message)
- If you don't know something specific, offer to create a support ticket for human follow-up
- Never make up specific numbers, prices, or rules unless they're in your knowledge base

${kbContext ? `\n\nKNOWLEDGE BASE:\n${kbContext}` : ""}

IMPORTANT: If a user asks to create a ticket or needs human help, respond with exactly this format at the end of your message:
[CREATE_TICKET]

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
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
