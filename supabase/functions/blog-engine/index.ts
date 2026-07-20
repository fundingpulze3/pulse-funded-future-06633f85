import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key" };
const num = (k: string, d: number) => Number(Deno.env.get(k) ?? d);
const WRITER = Deno.env.get("BLOG_ENGINE_MODEL") || "claude-3-7-sonnet-20250219";
const IDEATE = Deno.env.get("BLOG_ENGINE_IDEATE_MODEL") || "claude-3-5-haiku-20241022";
const PRICE_IN = num("BLOG_ENGINE_PRICE_IN", 3), PRICE_OUT = num("BLOG_ENGINE_PRICE_OUT", 15);
const DAILY_CAP = num("BLOG_ENGINE_DAILY_CAP", 10), DAILY_USD_CAP = num("BLOG_ENGINE_DAILY_USD_CAP", 0.45);
const PER_BLOG_USD_CAP = num("BLOG_ENGINE_PER_BLOG_USD_CAP", 0.10);
const KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Supabase injects these into every edge function — nothing to configure.
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const utcDay = () => new Date().toISOString().slice(0, 10);
const costOf = (i: number, o: number) => (i / 1e6) * PRICE_IN + (o / 1e6) * PRICE_OUT;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
const maxOut = () => Math.max(2000, Math.min(8000, Math.floor((PER_BLOG_USD_CAP / PRICE_OUT) * 1e6)));

async function claude(model: string, maxTokens: number, system: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.7, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("anthropic: " + (await r.text()).slice(0, 200));
  const d = await r.json();
  return { text: (d.content ?? []).map((b: { text?: string }) => b?.text ?? "").join(""), inTok: d.usage?.input_tokens ?? 0, outTok: d.usage?.output_tokens ?? 0 };
}
// deno-lint-ignore no-explicit-any
function parseJson(t: string): any { try { const m = t.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, t]; return JSON.parse((m[1] as string).trim()); } catch { return null; } }

async function settings() {
  const { data } = await supabase.from("blog_settings").select("*").eq("id", 1).maybeSingle();
  return data ?? { brand_context: "", themes: "", target_countries: "", auto_publish: false, slots: "09:00,14:00,19:00", cron_key: "" };
}
async function todayUsage() {
  const { data } = await supabase.from("blog_engine_usage").select("cost_usd").eq("day", utcDay()).eq("ok", true);
  return { count: data?.length ?? 0, spent: (data ?? []).reduce((s: number, r: { cost_usd: number }) => s + Number(r.cost_usd || 0), 0) };
}
async function capBlocked() {
  const u = await todayUsage();
  if (u.count >= DAILY_CAP) return `daily cap (${DAILY_CAP})`;
  if (u.spent >= DAILY_USD_CAP) return "daily budget";
  return null;
}
async function adminId() {
  const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  return data?.user_id ?? null;
}

function systemPrompt(brand: string, country?: string) {
  const loc = country ? `

WRITE THIS ONE FOR: ${country}
- Speak to a trader in ${country}: their currency (shown with the USD figure), market hours, instruments and the search phrasing they'd type.
- Mature, competitive market — the reader is comparing firms. Be specific and technical, no beginner fluff, no hype.
- Follow local financial-promotion norms: no performance promises, no implied earnings, include a plain risk warning.
- No tax, legal or regulatory advice. Never invent country-specific features or payment methods.` : "";
  return `You are an elite SEO content engine and long-form writer producing deeply useful, citation-ready articles that rank on Google and get cited by AI answer engines.

QUALITY BAR
- Match search intent with real depth; related keywords woven in naturally, never stuffed.
- Clear H2/H3 structure, short scannable paragraphs, concrete examples, actionable steps.
- No markdown tables. No emoji. No filler openers. No unverifiable claims.
- Write as one real, experienced person to one reader: contractions, varied rhythm, specifics over generalities.

BRAND CONTEXT (obey exactly; never invent facts)
${brand || "No brand context set — write brand-neutral content and name no company."}${loc}`;
}
const articlePrompt = (topic: string, pk: string, sk?: string, note?: string) => `Write a complete, SEO-optimized article.

Topic: ${topic}
Primary keyword: ${pk}
Secondary keywords: ${sk || "none"}
${note ? `Source research to build on (use it, don't contradict it):\n${note}\n` : ""}
Return ONE JSON object, no fences:
{"seo_metadata":{"seo_title":"50-60 chars","meta_description":"150-160 chars","url_slug":"hyphenated"},
 "keyword_strategy":{"primary_keyword":"${pk}","secondary_keywords":["..."],"lsi_keywords":["10-20"],"search_intent":"informational|commercial|transactional|navigational"},
 "blog_content":"markdown, ~1500-2200 words",
 "featured_snippet":"40-60 words",
 "faq_section":[{"question":"...","answer":"..."}]}`;

/** Write one post as a DRAFT and return its id. Pulls from the feed queue first. */
async function writeDraft() {
  const blocked = await capBlocked();
  if (blocked) return { skipped: blocked };
  const author = await adminId();
  if (!author) return { skipped: "no admin author" };
  const s = await settings();

  const { data: recent } = await supabase.from("blog_posts").select("title").order("created_at", { ascending: false }).limit(25);
  const seen = (recent ?? []).map((p: { title: string }) => p.title).join("; ");

  // 1) topic: the admin's feed queue wins, else auto-ideate for a rotating country
  const { data: queued } = await supabase.from("blog_topics").select("*")
    .eq("status", "queued").order("priority", { ascending: false }).order("created_at").limit(1).maybeSingle();

  let topic = queued?.query, pk = queued?.query, sk = "", note = queued?.research_note ?? "", country = queued?.country ?? "";
  let ideaCost = 0;
  if (queued) await supabase.from("blog_topics").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", queued.id);
  else {
    const countries = (s.target_countries || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    const fresh = countries.filter((c: string) => !seen.toLowerCase().includes(c.toLowerCase()));
    const pool = fresh.length ? fresh : countries;
    country = pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";
    const idea = await claude(IDEATE, 400, "You suggest one fresh, specific, high-search-intent blog topic. JSON only.",
      `Brand: ${s.brand_context || "a general blog"}\nThemes: ${s.themes || "(any)"}${country ? `\nTarget country: ${country}. Pick something a trader there would actually search.` : ""}\nDo NOT repeat: ${seen || "(none)"}\n\nReturn {"topic":"...","primary_keyword":"...","secondary_keywords":"a,b"}`);
    const i = parseJson(idea.text);
    ideaCost = costOf(idea.inTok, idea.outTok);
    if (!i?.topic) return { skipped: "ideation failed" };
    topic = i.topic; pk = i.primary_keyword || i.topic; sk = i.secondary_keywords || "";
  }

  // 2) write it
  const art = await claude(WRITER, maxOut(), systemPrompt(s.brand_context, country), articlePrompt(topic!, pk!, sk, note));
  const a = parseJson(art.text);
  const total = ideaCost + costOf(art.inTok, art.outTok);
  if (!a?.blog_content) {
    if (queued) await supabase.from("blog_topics").update({ status: "failed", error: "generation failed" }).eq("id", queued.id);
    await supabase.from("blog_engine_usage").insert({ day: utcDay(), model: WRITER, topic, ok: false, cost_usd: Math.round(total * 1e4) / 1e4 });
    return { skipped: "generation failed" };
  }

  const faq = Array.isArray(a.faq_section) && a.faq_section.length
    ? "\n\n## Frequently Asked Questions\n\n" + a.faq_section.map((f: { question: string; answer: string }) => `### ${f.question}\n\n${f.answer}`).join("\n\n") : "";
  const content = a.blog_content + faq;
  const words = content.split(/\s+/).length;
  let slug = slugify(a.seo_metadata?.url_slug || topic!);
  const { data: clash } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: post, error } = await supabase.from("blog_posts").insert({
    title: a.seo_metadata?.seo_title || topic, slug, content, excerpt: a.featured_snippet || null,
    author_id: author, is_published: false,
    meta_title: a.seo_metadata?.seo_title || null, meta_description: a.seo_metadata?.meta_description || null,
    focus_keyword: pk, reading_time: Math.max(1, Math.round(words / 200)),
  }).select("id").single();

  await supabase.from("blog_engine_usage").insert({
    day: utcDay(), model: WRITER, topic, input_tokens: art.inTok, output_tokens: art.outTok,
    cost_usd: Math.round(total * 1e4) / 1e4, words, ok: !error,
  });
  if (error) return { skipped: error.message };

  if (queued) await supabase.from("blog_topics").update({ status: "done", post_id: post.id, updated_at: new Date().toISOString() }).eq("id", queued.id);
  await supabase.from("blog_prepared").insert({ post_id: post.id, query: topic, source: queued ? "queue" : "auto", status: "ready" });
  return { postId: post.id, title: a.seo_metadata?.seo_title || topic, country };
}

/** Publish the oldest ready draft. */
async function publishPrepared() {
  const { data: prep } = await supabase.from("blog_prepared").select("*").eq("status", "ready").order("created_at").limit(1).maybeSingle();
  if (!prep) return null;
  await supabase.from("blog_posts").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", prep.post_id);
  await supabase.from("blog_prepared").update({ status: "posted" }).eq("id", prep.id);
  return prep;
}

/** Cron tick: publish if a slot is due, then pre-write the next one. */
async function tick() {
  const s = await settings();
  if (!s.auto_publish) return { skipped: "auto-pilot off" };
  const now = new Date();
  const hhmm = now.toISOString().slice(11, 16);
  const slots: string[] = (s.slots || "").split(",").map((x: string) => x.trim()).filter(Boolean);
  const due = slots.filter((t) => t <= hhmm).sort();
  const results: string[] = [];

  for (const slot of due) {
    const { error: claimErr } = await supabase.from("blog_slot_runs").insert({ day: utcDay(), slot, status: "running" });
    if (claimErr) continue; // already ran (unique day+slot)
    const blocked = await capBlocked();
    if (blocked) { await supabase.from("blog_slot_runs").update({ status: "skipped", note: blocked }).eq("day", utcDay()).eq("slot", slot); continue; }

    let prep = await publishPrepared();
    if (!prep) { const w = await writeDraft(); if (w.postId) prep = await publishPrepared(); }
    await supabase.from("blog_slot_runs").update({
      status: prep ? "posted" : "failed", post_id: prep?.post_id ?? null, note: prep ? null : "nothing to post",
    }).eq("day", utcDay()).eq("slot", slot);
    results.push(`${slot}:${prep ? "posted" : "failed"}`);
  }

  // keep one draft warm for the next slot
  const { data: ready } = await supabase.from("blog_prepared").select("id").eq("status", "ready").limit(1);
  if (!ready?.length && !(await capBlocked())) { const w = await writeDraft(); results.push(`prepared:${w.postId ? "ok" : w.skipped}`); }
  return { ran: results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    if (!KEY) return json({ error: "Set ANTHROPIC_API_KEY" }, 500);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "tick";

    if (action === "tick") {
      const s = await settings();
      if (!s.cron_key || req.headers.get("x-cron-key") !== s.cron_key) return json({ error: "forbidden" }, 403);
      return json(await tick());
    }

    // admin-only actions
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "admins only" }, 403);

    if (action === "queue") {
      const { query, research_note, category, country, priority } = body;
      if (!query?.trim()) return json({ error: "topic required" }, 400);
      const { error } = await supabase.from("blog_topics").insert({
        query: query.trim(), research_note: research_note || null, category: category || null,
        country: country || null, source: "feed", priority: priority ?? 100,
      });
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    if (action === "generate") return json(await writeDraft());
    if (action === "publish_next") { const p = await publishPrepared(); return json({ ok: !!p, post_id: p?.post_id ?? null }); }
    if (action === "run_slot") return json(await (async () => { const w = await writeDraft(); await publishPrepared(); return w; })());
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
