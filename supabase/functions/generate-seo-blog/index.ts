import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const num = (k: string, d: number) => Number(Deno.env.get(k) ?? d);
const MODEL = Deno.env.get("BLOG_ENGINE_MODEL") || "claude-3-7-sonnet-20250219";
const PRICE_IN = num("BLOG_ENGINE_PRICE_IN", 3);      // USD / 1M input tokens
const PRICE_OUT = num("BLOG_ENGINE_PRICE_OUT", 15);   // USD / 1M output tokens
const DAILY_CAP = num("BLOG_ENGINE_DAILY_CAP", 10);   // max generations / UTC day
const DAILY_USD_CAP = num("BLOG_ENGINE_DAILY_USD_CAP", 0.45); // max spend / day
const PER_BLOG_USD_CAP = num("BLOG_ENGINE_PER_BLOG_USD_CAP", 0.10); // spend / blog

const utcDay = () => new Date().toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { topic, primary_keyword, secondary_keywords, training_context } = await req.json();
    if (!topic || !primary_keyword) return json({ error: "Topic and primary keyword are required" }, 400);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "Set ANTHROPIC_API_KEY to enable the blog engine." }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Cost guards ──────────────────────────────────────────────────────────
    const { data: today } = await supabase
      .from("blog_engine_usage").select("cost_usd").eq("day", utcDay()).eq("ok", true);
    const count = today?.length ?? 0;
    const spent = (today ?? []).reduce((s: number, r: { cost_usd: number }) => s + Number(r.cost_usd || 0), 0);
    if (count >= DAILY_CAP) return json({ error: `Daily limit reached (${DAILY_CAP} posts). Try again tomorrow.` }, 429);
    if (spent >= DAILY_USD_CAP) return json({ error: "Daily AI budget reached. Try again tomorrow." }, 429);

    // Output tokens dominate cost — size the article to stay under the per-blog cap.
    const maxOut = Math.max(2000, Math.min(8000, Math.floor((PER_BLOG_USD_CAP / PRICE_OUT) * 1_000_000)));

    const brand = typeof training_context === "string" && training_context.trim()
      ? training_context.trim()
      : "No brand context provided — write brand-neutral, generally useful content. Do not name or invent any company.";

    const systemPrompt = `You are an elite SEO content engine and long-form writer. You produce deeply useful, citation-ready articles that rank on Google and get cited by AI answer engines (ChatGPT, Perplexity, Gemini, Google AI Overviews).

QUALITY BAR
- Match search intent with real topical depth; weave semantic and related keywords in naturally, never stuff them.
- Clear H2/H3 structure, scannable short paragraphs, concrete examples, and step-by-step guidance.
- No markdown tables (the CMS renders plain markdown) — use headings and comparison paragraphs instead.
- No emoji in the body. No filler openers ("In today's fast-paced world", "In conclusion", "It's important to note"). Open on the reader's real situation.
- No unverifiable claims ("guaranteed", "risk-free", "100% safe"). No medical, legal, or individualized financial advice.

HUMAN VOICE (must not read like AI)
- Write as one real, experienced person speaking to one reader. Use "you", contractions, and vary sentence and paragraph rhythm.
- Prefer specifics over generalities; show, don't lecture.

BRAND CONTEXT (obey exactly; never invent facts about the brand)
${brand}`;

    const userPrompt = `Write a complete, SEO-optimized article.

Topic: ${topic}
Primary keyword: ${primary_keyword}
Secondary keywords: ${secondary_keywords || "none provided"}

Return ONE JSON object, no markdown fences, with exactly these keys:
{
  "seo_metadata": { "seo_title": "50-60 chars, includes the primary keyword", "meta_description": "150-160 chars, includes the primary keyword", "url_slug": "short, hyphen-separated, contains the primary keyword" },
  "keyword_strategy": { "primary_keyword": "${primary_keyword}", "secondary_keywords": ["..."], "lsi_keywords": ["10-20 related terms"], "search_intent": "informational|commercial|transactional|navigational" },
  "blog_content": "Full markdown article, ~1500-2200 words. H1 title, hooked intro, H2/H3 sections, lists, examples, actionable insight. Humans first.",
  "featured_snippet": "40-60 word answer that could win a Google featured snippet",
  "faq_section": [ { "question": "a People-Also-Ask style question", "answer": "concise helpful answer" } ]
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxOut,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      await supabase.from("blog_engine_usage").insert({ day: utcDay(), model: MODEL, topic, ok: false });
      return json({ error: "AI generation failed" }, 500);
    }

    const data = await res.json();
    const text: string = (data.content ?? []).map((b: { text?: string }) => b?.text ?? "").join("");
    const inTok = data.usage?.input_tokens ?? 0;
    const outTok = data.usage?.output_tokens ?? 0;
    const costUsd = (inTok / 1_000_000) * PRICE_IN + (outTok / 1_000_000) * PRICE_OUT;

    let parsed: Record<string, unknown>;
    try {
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      parsed = JSON.parse((m[1] as string).trim());
    } catch {
      parsed = { raw_content: text, parse_error: true };
    }

    await supabase.from("blog_engine_usage").insert({
      day: utcDay(), model: MODEL, topic, input_tokens: inTok, output_tokens: outTok,
      cost_usd: Math.round(costUsd * 10000) / 10000, ok: !parsed.parse_error,
    });

    return json(parsed);
  } catch (error) {
    console.error("Error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
