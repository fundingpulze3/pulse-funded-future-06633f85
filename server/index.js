import express from "express";
import cors from "cors";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

const num = (k, d) => Number(process.env[k] ?? d);
const WRITER = process.env.BLOG_ENGINE_MODEL || "claude-3-7-sonnet-20250219";
const IDEATE = process.env.BLOG_ENGINE_IDEATE_MODEL || "claude-3-5-haiku-20241022";
const PRICE_IN = num("BLOG_ENGINE_PRICE_IN", 3);
const PRICE_OUT = num("BLOG_ENGINE_PRICE_OUT", 15);
const DAILY_CAP = num("BLOG_ENGINE_DAILY_CAP", 10);
const DAILY_USD_CAP = num("BLOG_ENGINE_DAILY_USD_CAP", 0.45);
const PER_BLOG_USD_CAP = num("BLOG_ENGINE_PER_BLOG_USD_CAP", 0.10);
const AUTO_CRON = process.env.AUTO_PUBLISH_CRON || "0 9 * * *";

const KEY = process.env.ANTHROPIC_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const utcDay = () => new Date().toISOString().slice(0, 10);
const costOf = (i, o) => (i / 1e6) * PRICE_IN + (o / 1e6) * PRICE_OUT;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);

async function claude(model, maxTokens, system, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.7, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("anthropic: " + (await r.text()).slice(0, 300));
  const d = await r.json();
  return {
    text: (d.content ?? []).map((b) => b?.text ?? "").join(""),
    inTok: d.usage?.input_tokens ?? 0,
    outTok: d.usage?.output_tokens ?? 0,
  };
}
function parseJson(text) {
  try { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]; return JSON.parse(m[1].trim()); } catch { return null; }
}
async function capsBlocked() {
  const { data } = await supabase.from("blog_engine_usage").select("cost_usd").eq("day", utcDay()).eq("ok", true);
  const spent = (data ?? []).reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  if ((data?.length ?? 0) >= DAILY_CAP) return `Daily limit reached (${DAILY_CAP} posts).`;
  if (spent >= DAILY_USD_CAP) return "Daily AI budget reached.";
  return null;
}
const maxOut = () => Math.max(2000, Math.min(8000, Math.floor((PER_BLOG_USD_CAP / PRICE_OUT) * 1e6)));

function systemPrompt(brand) {
  return `You are an elite SEO content engine and long-form writer. You produce deeply useful, citation-ready articles that rank on Google and get cited by AI answer engines.

QUALITY BAR
- Match search intent with real depth; weave related keywords in naturally, never stuff.
- Clear H2/H3 structure, short scannable paragraphs, concrete examples, actionable steps.
- No markdown tables (the CMS renders plain markdown). No emoji. No filler openers.
- No unverifiable claims ("guaranteed", "risk-free"). No medical, legal or individualized financial advice.

HUMAN VOICE (must not read like AI)
- Write as one real, experienced person speaking to one reader. Contractions, varied rhythm, specifics over generalities.

BRAND CONTEXT (obey exactly; never invent facts about the brand)
${brand || "No brand context set — write brand-neutral, generally useful content and do not name any company."}`;
}
const articlePrompt = (topic, pk, sk) => `Write a complete, SEO-optimized article.

Topic: ${topic}
Primary keyword: ${pk}
Secondary keywords: ${sk || "none provided"}

Return ONE JSON object, no markdown fences, exactly these keys:
{
  "seo_metadata": { "seo_title": "50-60 chars incl. primary keyword", "meta_description": "150-160 chars", "url_slug": "hyphenated-slug" },
  "keyword_strategy": { "primary_keyword": "${pk}", "secondary_keywords": ["..."], "lsi_keywords": ["10-20 related terms"], "search_intent": "informational|commercial|transactional|navigational" },
  "blog_content": "Full markdown article ~1500-2200 words. H1, hooked intro, H2/H3 sections, lists, examples.",
  "featured_snippet": "40-60 word snippet answer",
  "faq_section": [ { "question": "...", "answer": "..." } ]
}`;

async function getBrand() {
  const { data } = await supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle();
  return data || { brand_context: "", themes: "", auto_publish: false };
}

// ── API ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) || true }));

app.get("/health", (_req, res) => res.json({ ok: true, model: WRITER, cron: AUTO_CRON }));

async function requireAdmin(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "unauthorized" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) return res.status(403).json({ error: "admins only" });
    next();
  } catch { res.status(401).json({ error: "unauthorized" }); }
}

app.post("/api/generate", requireAdmin, async (req, res) => {
  try {
    if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
    const { topic, primary_keyword, secondary_keywords, training_context } = req.body || {};
    if (!topic || !primary_keyword) return res.status(400).json({ error: "Topic and primary keyword are required" });
    const blocked = await capsBlocked();
    if (blocked) return res.status(429).json({ error: blocked });

    const brand = training_context?.trim() || (await getBrand()).brand_context;
    const out = await claude(WRITER, maxOut(), systemPrompt(brand), articlePrompt(topic, primary_keyword, secondary_keywords));
    const parsed = parseJson(out.text) || { raw_content: out.text, parse_error: true };
    await supabase.from("blog_engine_usage").insert({
      day: utcDay(), model: WRITER, topic, input_tokens: out.inTok, output_tokens: out.outTok,
      cost_usd: Math.round(costOf(out.inTok, out.outTok) * 10000) / 10000, ok: !parsed.parse_error,
    });
    res.json(parsed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ── the upload timer ─────────────────────────────────────────────────────────
async function autoPublish() {
  if (!KEY) return console.log("[auto] no ANTHROPIC_API_KEY, skipping");
  const settings = await getBrand();
  if (!settings.auto_publish) return console.log("[auto] auto_publish off");
  const blocked = await capsBlocked();
  if (blocked) return console.log("[auto] " + blocked);

  const { data: admin } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  if (!admin?.user_id) return console.log("[auto] no admin author");
  const { data: recent } = await supabase.from("blog_posts").select("title").order("created_at", { ascending: false }).limit(25);
  const seen = (recent ?? []).map((p) => p.title).join("; ");

  const idea = await claude(IDEATE, 400,
    "You suggest one fresh, specific, high-search-intent blog topic. Output strict JSON only.",
    `Brand/context: ${settings.brand_context || "a general-interest blog"}\nThemes: ${settings.themes || "(any relevant)"}\nDo NOT repeat: ${seen || "(none)"}\n\nReturn JSON: {"topic":"...","primary_keyword":"...","secondary_keywords":"comma,separated"}`);
  const i = parseJson(idea.text);
  if (!i?.topic || !i?.primary_keyword) return console.log("[auto] ideation failed");

  const art = await claude(WRITER, maxOut(), systemPrompt(settings.brand_context), articlePrompt(i.topic, i.primary_keyword, i.secondary_keywords));
  const a = parseJson(art.text);
  const total = costOf(idea.inTok, idea.outTok) + costOf(art.inTok, art.outTok);
  if (!a?.blog_content) {
    await supabase.from("blog_engine_usage").insert({ day: utcDay(), model: WRITER, topic: i.topic, ok: false, cost_usd: Math.round(total * 10000) / 10000 });
    return console.log("[auto] generation failed");
  }

  const faq = Array.isArray(a.faq_section) && a.faq_section.length
    ? "\n\n## Frequently Asked Questions\n\n" + a.faq_section.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n") : "";
  const content = a.blog_content + faq;
  let slug = slugify(a.seo_metadata?.url_slug || i.topic);
  const { data: clash } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { error } = await supabase.from("blog_posts").insert({
    title: a.seo_metadata?.seo_title || i.topic, slug, content,
    excerpt: a.featured_snippet || null, author_id: admin.user_id,
    is_published: true, published_at: new Date().toISOString(),
    meta_title: a.seo_metadata?.seo_title || null, meta_description: a.seo_metadata?.meta_description || null,
    focus_keyword: i.primary_keyword,
    reading_time: Math.max(1, Math.round(content.split(/\s+/).length / 200)),
  });
  await supabase.from("blog_engine_usage").insert({
    day: utcDay(), model: WRITER, topic: i.topic, input_tokens: art.inTok, output_tokens: art.outTok,
    cost_usd: Math.round(total * 10000) / 10000, ok: !error,
  });
  console.log(error ? "[auto] insert failed: " + error.message : "[auto] published: " + slug);
}

app.post("/api/auto-publish", requireAdmin, async (_req, res) => {
  try { await autoPublish(); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

if (cron.validate(AUTO_CRON)) {
  cron.schedule(AUTO_CRON, () => autoPublish().catch((e) => console.error("[auto]", e.message)), { timezone: "UTC" });
  console.log("auto-publish scheduled:", AUTO_CRON, "(UTC)");
}

app.listen(process.env.PORT || 4000, () => console.log("blog engine on", process.env.PORT || 4000));
