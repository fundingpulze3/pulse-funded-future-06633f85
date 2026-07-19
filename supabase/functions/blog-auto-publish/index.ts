import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const num = (k: string, d: number) => Number(Deno.env.get(k) ?? d);
const WRITER = Deno.env.get("BLOG_ENGINE_MODEL") || "claude-3-7-sonnet-20250219";
const IDEATE = Deno.env.get("BLOG_ENGINE_IDEATE_MODEL") || "claude-3-5-haiku-20241022";
const PRICE_IN = num("BLOG_ENGINE_PRICE_IN", 3), PRICE_OUT = num("BLOG_ENGINE_PRICE_OUT", 15);
const DAILY_CAP = num("BLOG_ENGINE_DAILY_CAP", 10), DAILY_USD_CAP = num("BLOG_ENGINE_DAILY_USD_CAP", 0.45);
const PER_BLOG_USD_CAP = num("BLOG_ENGINE_PER_BLOG_USD_CAP", 0.10);
const utcDay = () => new Date().toISOString().slice(0, 10);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);

async function anthropic(key: string, model: string, maxTokens: number, system: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.7, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("anthropic:" + (await r.text()).slice(0, 200));
  const d = await r.json();
  const text = (d.content ?? []).map((b: { text?: string }) => b?.text ?? "").join("");
  return { text, inTok: d.usage?.input_tokens ?? 0, outTok: d.usage?.output_tokens ?? 0 };
}
const cost = (i: number, o: number) => (i / 1e6) * PRICE_IN + (o / 1e6) * PRICE_OUT;
function parseJson(text: string): any {
  try { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]; return JSON.parse((m[1] as string).trim()); } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: settings } = await supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings?.auto_publish) return json({ skipped: "auto_publish off" });

    const { data: today } = await supabase.from("blog_engine_usage").select("cost_usd").eq("day", utcDay()).eq("ok", true);
    const spent = (today ?? []).reduce((s: number, r: { cost_usd: number }) => s + Number(r.cost_usd || 0), 0);
    if ((today?.length ?? 0) >= DAILY_CAP || spent >= DAILY_USD_CAP) return json({ skipped: "cap reached" });

    const { data: adminRole } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    if (!adminRole?.user_id) return json({ skipped: "no admin author" });

    const { data: recent } = await supabase.from("blog_posts").select("title").order("created_at", { ascending: false }).limit(25);
    const recentTitles = (recent ?? []).map((p: { title: string }) => p.title).join("; ");

    // 1) ideate one fresh topic (cheap model)
    const brand = settings.brand_context || "a general-interest blog";
    const idea = await anthropic(key, IDEATE, 400,
      "You suggest one fresh, specific, high-search-intent blog topic. Output strict JSON only.",
      `Brand/context: ${brand}\nThemes to draw from: ${settings.themes || "(any relevant to the brand)"}\nDo NOT repeat any of these recent titles: ${recentTitles || "(none)"}\n\nReturn JSON: {"topic":"...","primary_keyword":"...","secondary_keywords":"comma,separated"}`);
    const ideaObj = parseJson(idea.text) || {};
    const topic = ideaObj.topic; const pk = ideaObj.primary_keyword;
    if (!topic || !pk) { await supabase.from("blog_engine_usage").insert({ day: utcDay(), model: IDEATE, ok: false, input_tokens: idea.inTok, output_tokens: idea.outTok, cost_usd: cost(idea.inTok, idea.outTok) }); return json({ error: "ideation failed" }, 500); }

    // 2) write the article (writer model), sized to the per-blog cap
    const maxOut = Math.max(2000, Math.min(8000, Math.floor((PER_BLOG_USD_CAP / PRICE_OUT) * 1e6)));
    const system = `You are an elite SEO content engine and long-form writer. Deep, useful, human-voiced articles that rank and get cited. Clear H2/H3, short scannable paragraphs, concrete examples, no markdown tables, no emoji, no filler openers, no unverifiable claims, no medical/legal/individualized financial advice. Write as one real person to one reader; use contractions and varied rhythm.\n\nBRAND CONTEXT (obey; never invent facts):\n${brand}`;
    const userP = `Write a complete SEO article on: ${topic}\nPrimary keyword: ${pk}\nSecondary keywords: ${ideaObj.secondary_keywords || "none"}\n\nReturn ONE JSON object, no fences:\n{"seo_metadata":{"seo_title":"50-60 chars","meta_description":"150-160 chars","url_slug":"hyphenated"},"blog_content":"markdown, ~1500-2000 words","featured_snippet":"40-60 words","faq_section":[{"question":"...","answer":"..."}]}`;
    const art = await anthropic(key, WRITER, maxOut, system, userP);
    const a = parseJson(art.text);
    const totalCost = cost(idea.inTok, idea.outTok) + cost(art.inTok, art.outTok);
    if (!a?.blog_content) { await supabase.from("blog_engine_usage").insert({ day: utcDay(), model: WRITER, topic, ok: false, input_tokens: art.inTok, output_tokens: art.outTok, cost_usd: totalCost }); return json({ error: "generation failed" }, 500); }

    const faq = Array.isArray(a.faq_section) && a.faq_section.length
      ? "\n\n## Frequently Asked Questions\n\n" + a.faq_section.map((f: { question: string; answer: string }) => `### ${f.question}\n\n${f.answer}`).join("\n\n") : "";
    const content = a.blog_content + faq;
    let slug = a.seo_metadata?.url_slug ? slugify(a.seo_metadata.url_slug) : slugify(topic);
    const { data: clash } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const readingTime = Math.max(1, Math.round(content.split(/\s+/).length / 200));

    const { error: insErr } = await supabase.from("blog_posts").insert({
      title: a.seo_metadata?.seo_title || topic,
      slug, content, excerpt: a.featured_snippet || null,
      author_id: adminRole.user_id,
      is_published: true, published_at: new Date().toISOString(),
      meta_title: a.seo_metadata?.seo_title || null,
      meta_description: a.seo_metadata?.meta_description || null,
      focus_keyword: pk, reading_time: readingTime,
    });
    await supabase.from("blog_engine_usage").insert({ day: utcDay(), model: WRITER, topic, input_tokens: art.inTok, output_tokens: art.outTok, cost_usd: Math.round(totalCost * 10000) / 10000, ok: !insErr });
    if (insErr) return json({ error: insErr.message }, 500);
    return json({ published: a.seo_metadata?.seo_title || topic, slug });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
