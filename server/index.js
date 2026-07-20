import express from "express";
import cors from "cors";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

const num = (k, d) => Number(process.env[k] ?? d);
const SUPABASE_URL = process.env.SUPABASE_URL || "https://rpshiyvndmnogbhbgmfm.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwc2hpeXZuZG1ub2diaGJnbWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NzYyOTIsImV4cCI6MjA4ODM1MjI5Mn0.6D_cf0IWQF_OFXOA01w26IRhXIbIai-anpWT2F1o_uY";
const ADMIN_EMAIL = process.env.BLOG_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.BLOG_ADMIN_PASSWORD;
const KEY = process.env.ANTHROPIC_API_KEY;

const WRITER = process.env.BLOG_ENGINE_MODEL || "claude-3-7-sonnet-20250219";
const IDEATE = process.env.BLOG_ENGINE_IDEATE_MODEL || "claude-3-5-haiku-20241022";
const PRICE_IN = num("BLOG_ENGINE_PRICE_IN", 3), PRICE_OUT = num("BLOG_ENGINE_PRICE_OUT", 15);
const DAILY_CAP = num("BLOG_ENGINE_DAILY_CAP", 10), DAILY_USD_CAP = num("BLOG_ENGINE_DAILY_USD_CAP", 0.45);
const PER_BLOG_USD_CAP = num("BLOG_ENGINE_PER_BLOG_USD_CAP", 0.10);
const SITE_URL = (process.env.SITE_URL || "https://fundingpulze.com").replace(/\/$/, "");
const SLOTS_FALLBACK = process.env.SLOTS || "09:00,14:00,19:00";

const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: true } });
let authed = false;
async function ensureAuth() {
  if (authed) return true;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return false;
  const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error) { console.error("[auth]", error.message); return false; }
  authed = true; console.log("[auth] signed in as", ADMIN_EMAIL);
  return true;
}
async function me() { const { data } = await supabase.auth.getUser(); return data?.user?.id ?? null; }

const utcDay = () => new Date().toISOString().slice(0, 10);
const costOf = (i, o) => (i / 1e6) * PRICE_IN + (o / 1e6) * PRICE_OUT;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
const maxOut = () => Math.max(2000, Math.min(8000, Math.floor((PER_BLOG_USD_CAP / PRICE_OUT) * 1e6)));

// works with or without the optional engine tables
let runtime = { auto: process.env.AUTO_PUBLISH !== "false", slots: SLOTS_FALLBACK };
let mem = { day: "", count: 0, spent: 0, slots: {} };
const memDay = () => { const d = utcDay(); if (mem.day !== d) mem = { day: d, count: 0, spent: 0, slots: {} }; return mem; };

async function claude(model, maxTokens, system, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.7, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("anthropic: " + (await r.text()).slice(0, 200));
  const d = await r.json();
  return { text: (d.content ?? []).map((b) => b?.text ?? "").join(""), inTok: d.usage?.input_tokens ?? 0, outTok: d.usage?.output_tokens ?? 0 };
}
function parseJson(t) { try { const m = t.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, t]; return JSON.parse(m[1].trim()); } catch { return null; } }

async function settings() {
  try {
    const { data, error } = await supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (!error && data) return { ...data, slots: data.slots || SLOTS_FALLBACK, auto_publish: data.auto_publish ?? true };
  } catch { /* table optional */ }
  return { brand_context: DEFAULT_BRAND, themes: DEFAULT_THEMES, target_countries: DEFAULT_COUNTRIES, slots: runtime.slots, auto_publish: runtime.auto, _fallback: true };
}
async function usageToday() {
  try {
    const { data, error } = await supabase.from("blog_engine_usage").select("cost_usd").eq("day", utcDay()).eq("ok", true);
    if (!error) return { count: data.length, spent: data.reduce((s, r) => s + Number(r.cost_usd || 0), 0) };
  } catch { /* fall back */ }
  const m = memDay(); return { count: m.count, spent: m.spent };
}
async function capBlocked() {
  const u = await usageToday();
  if (u.count >= DAILY_CAP) return `daily cap (${DAILY_CAP})`;
  if (u.spent >= DAILY_USD_CAP) return "daily budget";
  return null;
}
async function logUsage(row) {
  const m = memDay(); m.count += 1; m.spent += Number(row.cost_usd || 0);
  try { await supabase.from("blog_engine_usage").insert(row); } catch { /* optional */ }
}

const DEFAULT_COUNTRIES = "United States, Canada, United Kingdom, Ireland, Australia, New Zealand, Germany, France, Switzerland, Austria, Netherlands, Belgium, Luxembourg, Denmark, Sweden, Norway, Finland, Iceland, Italy, Spain, Portugal, Singapore, Japan, South Korea, United Arab Emirates, Qatar";
const DEFAULT_THEMES = "passing prop firm evaluations, drawdown rules explained, risk management for funded accounts, profit split and payout guides, trading psychology, funded trader roadmap, choosing a prop firm, common evaluation mistakes, position sizing, trading plan building";
const DEFAULT_BRAND = `Funding Pulze is a proprietary trading firm. Positioning: "Get Funded. Trade Big. Keep the Profits."

WHAT WE OFFER
- Evaluation challenges on account sizes $5K, $10K, $25K, $50K and $100K.
- 2-Step: Phase 1 profit target 8%, Phase 2 target 5%. 1-Step: 8% in a single phase. No time limit on any phase.
- Maximum overall drawdown: 10% of the initial account balance.
- Daily drawdown: 5%, measured from the balance at the start of the trading day (00:00 UTC), resets daily.
- Minimum 3 active trading days per phase.
- Weekend holding is allowed. Swap-free accounts are available.

PAYOUTS
- Reward cycles: Weekly (60% profit split), Bi-weekly (80%), On Demand (90%), Monthly (100%).
- Methods: bank wire, crypto (USDT/BTC/ETH) and PayPal. Processed in 24-48 hours. No minimum withdrawal.

ONBOARDING
- Login credentials are emailed within minutes of purchase.

NON-NEGOTIABLES
- Never guarantee profits. Never use "risk-free", "guaranteed" or "no risk".
- Never invent rules, prices, numbers or features not listed above.
- Be honest that evaluations are demanding and many traders do not pass first attempt.
- No individualized financial advice. Add a short risk note where relevant.
- Never name a competitor as a scam. Trading involves substantial risk of loss.`;

const CTA_RULES = `
MUST INCLUDE (this is a conversion asset, not just an article)
- 2 to 4 CTA callouts spread through the piece (never two in a row), each on its own line in EXACTLY this format:
  > **CTA:** <one short persuasive sentence> [<button label>](<url>)
  Only use these real URLs: /checkout (start a challenge), /faq, /about, /blog, /. Never invent a URL.
- 2 to 3 outbound links to genuinely authoritative sources (Wikipedia, Investopedia, a regulator or exchange page).
- 2 to 3 internal links to the pages listed above, in natural sentences.
- 8 to 15 specific tags in "tags".`;

function systemPrompt(brand, country) {
  const loc = country ? `

WRITE THIS ONE FOR: ${country}
- Speak to a trader in ${country}: their currency (with the USD figure), market hours, instruments and local search phrasing.
- Mature, competitive market — the reader is comparing firms. Specific and technical, no beginner fluff, no hype.
- Follow local financial-promotion norms: no performance promises, no implied earnings, include a plain risk warning.
- No tax, legal or regulatory advice. Never invent country-specific features or payment methods.` : "";
  return `You are an elite SEO content engine and long-form writer producing deeply useful, citation-ready articles that rank on Google and get cited by AI answer engines.

QUALITY BAR
- Match search intent with real depth; related keywords woven in naturally, never stuffed.
- Clear H2/H3 structure, short scannable paragraphs, concrete examples, actionable steps.
- No markdown tables. No emoji. No filler openers. No unverifiable claims.
- Write as one real, experienced person to one reader: contractions, varied rhythm, specifics over generalities.

BRAND CONTEXT (obey exactly; never invent facts)
${brand || DEFAULT_BRAND}${loc}`;
}
const articlePrompt = (topic, pk, sk, note) => `Write a complete, SEO-optimized article.

Topic: ${topic}
Primary keyword: ${pk}
Secondary keywords: ${sk || "none"}
${note ? `Source research to build on (use it, don't contradict it):\n${note}\n` : ""}
Return ONE JSON object, no fences:
{"seo_metadata":{"seo_title":"50-60 chars","meta_description":"150-160 chars","url_slug":"hyphenated"},
 "keyword_strategy":{"primary_keyword":"${pk}","secondary_keywords":["..."],"lsi_keywords":["10-20"],"search_intent":"informational|commercial|transactional|navigational"},
 "blog_content":"markdown, ~1500-2200 words",
 "featured_snippet":"40-60 words",
 "tags":["8-15 specific tags"],
 "faq_section":[{"question":"...","answer":"..."}]}
${CTA_RULES}`;

async function writeDraft() {
  if (!(await ensureAuth())) return { skipped: "admin login not configured" };
  const blocked = await capBlocked();
  if (blocked) return { skipped: blocked };
  const author = await me();
  if (!author) return { skipped: "not signed in" };
  const s = await settings();

  const { data: recent } = await supabase.from("blog_posts").select("title").order("created_at", { ascending: false }).limit(25);
  const seen = (recent ?? []).map((p) => p.title).join("; ");

  let queued = null;
  try {
    const { data } = await supabase.from("blog_topics").select("*").eq("status", "queued")
      .order("priority", { ascending: false }).order("created_at").limit(1).maybeSingle();
    queued = data ?? null;
  } catch { /* optional */ }

  let topic = queued?.query, pk = queued?.query, sk = "", note = queued?.research_note ?? "", country = queued?.country ?? "";
  let ideaCost = 0;
  if (queued) { try { await supabase.from("blog_topics").update({ status: "generating" }).eq("id", queued.id); } catch {} }
  else {
    const countries = (s.target_countries || DEFAULT_COUNTRIES).split(",").map((c) => c.trim()).filter(Boolean);
    const fresh = countries.filter((c) => !seen.toLowerCase().includes(c.toLowerCase()));
    const pool = fresh.length ? fresh : countries;
    country = pool[Math.floor(Math.random() * pool.length)] || "";
    const idea = await claude(IDEATE, 400, "You suggest one fresh, specific, high-search-intent blog topic. JSON only.",
      `Brand: ${s.brand_context || DEFAULT_BRAND}\nThemes: ${s.themes || DEFAULT_THEMES}\nTarget country: ${country}. Pick something a trader there would actually search.\nDo NOT repeat: ${seen || "(none)"}\n\nReturn {"topic":"...","primary_keyword":"...","secondary_keywords":"a,b"}`);
    const i = parseJson(idea.text);
    ideaCost = costOf(idea.inTok, idea.outTok);
    if (!i?.topic) return { skipped: "ideation failed" };
    topic = i.topic; pk = i.primary_keyword || i.topic; sk = i.secondary_keywords || "";
  }

  const art = await claude(WRITER, maxOut(), systemPrompt(s.brand_context, country), articlePrompt(topic, pk, sk, note));
  const a = parseJson(art.text);
  const total = ideaCost + costOf(art.inTok, art.outTok);
  if (!a?.blog_content) {
    await logUsage({ day: utcDay(), model: WRITER, topic, ok: false, cost_usd: Math.round(total * 1e4) / 1e4 });
    return { skipped: "generation failed" };
  }

  const faq = Array.isArray(a.faq_section) && a.faq_section.length
    ? "\n\n## Frequently Asked Questions\n\n" + a.faq_section.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n") : "";
  const content = a.blog_content + faq;
  const words = content.split(/\s+/).length;
  let slug = slugify(a.seo_metadata?.url_slug || topic);
  const { data: clash } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: post, error } = await supabase.from("blog_posts").insert({
    title: a.seo_metadata?.seo_title || topic, slug, content, excerpt: a.featured_snippet || null,
    author_id: author, is_published: false,
    meta_title: a.seo_metadata?.seo_title || null, meta_description: a.seo_metadata?.meta_description || null,
    meta_keywords: Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === "string").slice(0, 15) : [],
    focus_keyword: pk, reading_time: Math.max(1, Math.round(words / 200)),
  }).select("id").single();

  await logUsage({ day: utcDay(), model: WRITER, topic, input_tokens: art.inTok, output_tokens: art.outTok, cost_usd: Math.round(total * 1e4) / 1e4, words, ok: !error });
  if (error) return { skipped: error.message };
  if (queued) { try { await supabase.from("blog_topics").update({ status: "done", post_id: post.id }).eq("id", queued.id); } catch {} }
  try { await supabase.from("blog_prepared").insert({ post_id: post.id, query: topic, source: queued ? "queue" : "auto", status: "ready" }); } catch {}
  return { postId: post.id, title: a.seo_metadata?.seo_title || topic, country };
}

async function publishPrepared() {
  let prep = null;
  try {
    const { data } = await supabase.from("blog_prepared").select("*").eq("status", "ready").order("created_at").limit(1).maybeSingle();
    prep = data ?? null;
  } catch { /* optional */ }
  if (!prep) {
    const { data } = await supabase.from("blog_posts").select("id").eq("is_published", false).order("created_at").limit(1).maybeSingle();
    if (!data) return null;
    await supabase.from("blog_posts").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", data.id);
    return { post_id: data.id };
  }
  await supabase.from("blog_posts").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", prep.post_id);
  try { await supabase.from("blog_prepared").update({ status: "posted" }).eq("id", prep.id); } catch {}
  return prep;
}

async function tick() {
  if (!(await ensureAuth())) return { skipped: "admin login not configured" };
  const s = await settings();
  if (!s.auto_publish) return { skipped: "auto-pilot off" };
  const hhmm = new Date().toISOString().slice(11, 16);
  const slots = (s.slots || SLOTS_FALLBACK).split(",").map((x) => x.trim()).filter(Boolean).sort();
  const results = [];

  for (const slot of slots.filter((t) => t <= hhmm)) {
    let claimed = false;
    try {
      const { error } = await supabase.from("blog_slot_runs").insert({ day: utcDay(), slot, status: "running" });
      claimed = !error;
    } catch { const m = memDay(); if (!m.slots[slot]) { m.slots[slot] = "running"; claimed = true; } }
    if (!claimed) continue;

    const blocked = await capBlocked();
    if (blocked) { try { await supabase.from("blog_slot_runs").update({ status: "skipped", note: blocked }).eq("day", utcDay()).eq("slot", slot); } catch {} memDay().slots[slot] = "skipped"; continue; }

    let prep = await publishPrepared();
    if (!prep) { const w = await writeDraft(); if (w.postId) prep = await publishPrepared(); }
    try { await supabase.from("blog_slot_runs").update({ status: prep ? "posted" : "failed", post_id: prep?.post_id ?? null }).eq("day", utcDay()).eq("slot", slot); } catch {}
    memDay().slots[slot] = prep ? "posted" : "failed";
    results.push(`${slot}:${prep ? "posted" : "failed"}`);
  }

  let ready = 0;
  try { const { data } = await supabase.from("blog_prepared").select("id").eq("status", "ready"); ready = data?.length ?? 0; } catch {}
  if (!ready && !(await capBlocked())) { const w = await writeDraft(); results.push(`prepared:${w.postId ? "ok" : w.skipped}`); }
  return { ran: results };
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) || true }));

app.get("/health", async (_req, res) => res.json({ ok: true, model: WRITER, signedIn: await ensureAuth(), slots: SLOTS_FALLBACK }));

app.get("/sitemap.xml", async (_req, res) => {
  try {
    const { data } = await supabase.from("blog_posts").select("slug, updated_at, published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(5000);
    const urls = (data ?? []).map((p) => `  <url><loc>${SITE_URL}/blog/${p.slug}</loc><lastmod>${new Date(p.updated_at || p.published_at || Date.now()).toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url>`).join("\n");
    res.set("Content-Type", "application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/blog</loc><changefreq>daily</changefreq></url>\n${urls}\n</urlset>`);
  } catch { res.status(500).send("sitemap error"); }
});

// Admin actions — caller must present the admin's Supabase access token.
async function requireAdmin(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "unauthorized" });
    next();
  } catch { res.status(401).json({ error: "unauthorized" }); }
}
app.post("/api/run-slot", requireAdmin, async (_req, res) => { try { const w = await writeDraft(); await publishPrepared(); res.json(w); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post("/api/generate", requireAdmin, async (_req, res) => { try { res.json(await writeDraft()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get("/api/status", async (_req, res) => {
  try {
    const s = await settings();
    const u = await usageToday();
    let lastPost = null, prepared = 0, published = 0;
    try { const { data } = await supabase.from("blog_posts").select("title,published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(1).maybeSingle(); lastPost = data ?? null; } catch {}
    try { const { data } = await supabase.from("blog_prepared").select("id").eq("status", "ready"); prepared = data?.length ?? 0; } catch {}
    try { const { count } = await supabase.from("blog_posts").select("id", { count: "exact", head: true }).eq("is_published", true); published = count ?? 0; } catch {}
    res.json({
      signedIn: await ensureAuth(), auto: s.auto_publish, slots: s.slots,
      today: u, caps: { daily: DAILY_CAP, usd: DAILY_USD_CAP },
      lastPost, prepared, published, slotRuns: memDay().slots, usingTables: !s._fallback,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings", requireAdmin, async (req, res) => {
  const { auto, slots } = req.body || {};
  if (typeof auto === "boolean") runtime.auto = auto;
  if (typeof slots === "string" && slots.trim()) runtime.slots = slots.trim();
  try { await supabase.from("blog_settings").update({ auto_publish: runtime.auto, slots: runtime.slots }).eq("id", 1); } catch {}
  res.json({ auto: runtime.auto, slots: runtime.slots });
});

app.post("/api/generate-article", requireAdmin, async (req, res) => {
  try {
    if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
    const { topic, primary_keyword, secondary_keywords, training_context } = req.body || {};
    if (!topic || !primary_keyword) return res.status(400).json({ error: "Topic and primary keyword are required" });
    const blocked = await capBlocked();
    if (blocked) return res.status(429).json({ error: `Limit reached: ${blocked}` });
    const s2 = await settings();
    const out = await claude(WRITER, maxOut(), systemPrompt(training_context?.trim() || s2.brand_context), articlePrompt(topic, primary_keyword, secondary_keywords, ""));
    const parsed = parseJson(out.text) || { raw_content: out.text, parse_error: true };
    await logUsage({ day: utcDay(), model: WRITER, topic, input_tokens: out.inTok, output_tokens: out.outTok, cost_usd: Math.round(costOf(out.inTok, out.outTok) * 1e4) / 1e4, words: (parsed.blog_content || "").split(/\s+/).length, ok: !parsed.parse_error });
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tick", async (_req, res) => { try { res.json(await tick()); } catch (e) { res.status(500).json({ error: e.message }); } });

cron.schedule("*/5 * * * *", () => tick().then((r) => r?.ran?.length && console.log("[tick]", r.ran)).catch((e) => console.error("[tick]", e.message)), { timezone: "UTC" });
app.listen(process.env.PORT || 4000, async () => { await ensureAuth(); console.log("blog engine up on", process.env.PORT || 4000); });
