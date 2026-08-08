/**
 * cTrader stats worker
 * --------------------
 * Runs OUTSIDE Lovable (Render / Railway / any always-on Node host).
 *
 * What it does, on a loop:
 *   1. Asks the `ctrader-ingest` edge function which accounts have an investor link.
 *   2. Opens each public cTrader investor page in headless Chromium.
 *   3. Reads every label/value pair the page renders and maps the known ones.
 *   4. POSTs the result back to `ctrader-ingest`, which writes `ctrader_snapshots`.
 *
 * Why a browser: the investor page is a JS app that streams its numbers over a
 * socket, so there is no plain REST endpoint to call. Rendering the page is the
 * only way to read those numbers with nothing but the investor link.
 *
 * Required env:
 *   INGEST_URL             https://<project-ref>.functions.supabase.co/ctrader-ingest
 *   CTRADER_INGEST_SECRET  same value saved in the Lovable backend secrets
 * Optional env:
 *   SYNC_INTERVAL_MINUTES  default 10
 *   PAGE_TIMEOUT_MS        default 45000
 *   SETTLE_MS              default 9000  (how long to let the page stream in)
 *   SYNC_ONCE              set to 1 to run a single pass and exit
 */

import { chromium } from "playwright";

const INGEST_URL = process.env.INGEST_URL;
const INGEST_SECRET = process.env.CTRADER_INGEST_SECRET;
const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MINUTES || 10) * 60 * 1000;
const PAGE_TIMEOUT_MS = Number(process.env.PAGE_TIMEOUT_MS || 45000);
const SETTLE_MS = Number(process.env.SETTLE_MS || 9000);
const RUN_ONCE = process.env.SYNC_ONCE === "1";

if (!INGEST_URL || !INGEST_SECRET) {
  console.error("Missing INGEST_URL or CTRADER_INGEST_SECRET env vars.");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function callIngest(payload) {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ingest-secret": INGEST_SECRET,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`ingest ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

/* ------------------------------------------------------------------ *
 * Label mapping. The investor page words things slightly differently
 * per broker/locale, so match on a normalised, lowercased label.
 * ------------------------------------------------------------------ */
const LABEL_MAP = [
  [/^(balance)$/, "balance"],
  [/^(equity|net asset value|nav)$/, "equity"],
  [/(margin used|used margin|^margin$)/, "margin_used"],
  [/(^roi$|return on investment|^gain$|^growth$|^return$)/, "roi_percent"],
  [/(open positions|positions open|^positions$)/, "open_positions_count"],
  [/(^profit$|net profit|total profit|absolute gain|^p\/l$|^pnl$)/, "profit"],
  [/(deposit|funds added)/, "deposits"],
  [/(win rate|winning rate|% profitable|profitable trades %)/, "win_rate"],
  [/(total trades|^trades$|closed trades|number of trades)/, "total_trades"],
  [/(winning trades|^won$|profitable trades)/, "winning_trades"],
  [/(losing trades|^lost$|loss trades)/, "losing_trades"],
  [/(profit factor)/, "profit_factor"],
  [/(max(imum)? drawdown|^drawdown$|relative drawdown)/, "max_drawdown_percent"],
  [/(average win|avg\.? win|average profit)/, "avg_win"],
  [/(average loss|avg\.? loss)/, "avg_loss"],
  [/(best trade|largest win|max win)/, "best_trade"],
  [/(worst trade|largest loss|max loss)/, "worst_trade"],
];

const PERCENT_FIELDS = new Set(["roi_percent", "win_rate", "max_drawdown_percent"]);

function parseNumber(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  const negative = /^\(.*\)$/.test(s) || s.includes("−") || /^-/.test(s);
  // strip currency symbols, spaces, parentheses, unicode minus, letters
  s = s.replace(/[()\s]/g, "").replace(/−/g, "-");
  const currency = (s.match(/[A-Za-z]{3}|[$€£¥₹]/) || [])[0] || null;
  s = s.replace(/[^0-9.,\-]/g, "");
  if (!s || !/[0-9]/.test(s)) return null;

  // 1.234,56 (EU) vs 1,234.56 (US)
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return { value: negative && n > 0 ? -n : n, currency };
}

/**
 * Pull every "label -> value" pair the rendered page exposes.
 * Strategy is deliberately structure-agnostic: look at every small element,
 * take its text, and pair it with the nearest numeric sibling/child text.
 */
async function extractPairs(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const numeric = /[0-9]/;

    const nodes = Array.from(document.querySelectorAll("body *"));
    for (const el of nodes) {
      if (el.children.length > 3) continue;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 90) continue;

      // Case A: element holds "Label 1,234.56" together
      const inline = text.match(/^([A-Za-z%\/.\s]{3,40}?)[:\s]\s*([-−(]?[$€£¥₹]?\s?[0-9][0-9.,\s]*%?\)?)$/);
      if (inline && numeric.test(inline[2])) {
        const key = inline[1].trim() + "|" + inline[2].trim();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ label: inline[1].trim(), value: inline[2].trim() });
        }
        continue;
      }

      // Case B: label element with a numeric sibling
      if (!numeric.test(text) && text.length >= 3) {
        const sib = el.nextElementSibling;
        const sibText = sib ? (sib.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (sibText && sibText.length <= 30 && numeric.test(sibText)) {
          const key = text + "|" + sibText;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ label: text, value: sibText });
          }
        }
      }
    }
    return out;
  });
}

function mapPairs(pairs) {
  const metrics = {};
  const raw = { pairs: pairs.slice(0, 120), scraped_at: new Date().toISOString() };

  for (const { label, value } of pairs) {
    const norm = label.toLowerCase().replace(/[:%]/g, "").replace(/\s+/g, " ").trim();
    const hit = LABEL_MAP.find(([re]) => re.test(norm));
    if (!hit) continue;
    const field = hit[1];
    if (metrics[field] !== undefined && metrics[field] !== null) continue;

    const parsed = parseNumber(value);
    if (!parsed) continue;

    // A value written as a percentage only belongs in percentage fields.
    const isPct = value.includes("%");
    if (PERCENT_FIELDS.has(field) === false && isPct) continue;

    metrics[field] = parsed.value;
    if (parsed.currency && !metrics.currency && !/^[0-9]/.test(parsed.currency)) {
      if (/^[A-Z]{3}$/.test(parsed.currency)) metrics.currency = parsed.currency;
      else if (parsed.currency === "$") metrics.currency = "USD";
      else if (parsed.currency === "€") metrics.currency = "EUR";
      else if (parsed.currency === "£") metrics.currency = "GBP";
      else if (parsed.currency === "₹") metrics.currency = "INR";
    }
  }

  // Derive whatever the page did not spell out.
  if (metrics.equity == null && metrics.balance != null) metrics.equity = metrics.balance;
  if (
    metrics.win_rate == null &&
    metrics.winning_trades != null &&
    metrics.total_trades > 0
  ) {
    metrics.win_rate = Number(((metrics.winning_trades / metrics.total_trades) * 100).toFixed(2));
  }
  if (
    metrics.roi_percent == null &&
    metrics.profit != null &&
    metrics.deposits > 0
  ) {
    metrics.roi_percent = Number(((metrics.profit / metrics.deposits) * 100).toFixed(2));
  }

  return { metrics, raw };
}

async function scrapeOne(browser, target) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const url = `https://ct.spotware.com/investor/${encodeURIComponent(target.token)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

    // Let the app authenticate the link and stream its numbers in.
    await page.waitForTimeout(SETTLE_MS);

    const bodyText = (await page.innerText("body").catch(() => "")).trim();
    if (!bodyText) {
      throw new Error("investor page rendered empty — link is invalid, expired or revoked");
    }
    if (/not found|no longer available|invalid|expired|revoked/i.test(bodyText.slice(0, 400))) {
      throw new Error(`investor page reports: ${bodyText.slice(0, 160)}`);
    }

    const pairs = await extractPairs(page);
    const { metrics, raw } = mapPairs(pairs);
    raw.body_excerpt = bodyText.slice(0, 1500);

    const accountName = (bodyText.match(/^(.{3,60})$/m) || [])[1];
    if (accountName && !metrics.account_name) metrics.account_name = accountName.trim();

    const found = Object.keys(metrics).filter((k) => metrics[k] !== null).length;
    log(`  ${target.account_label || target.credential_id}: ${found} metrics`);

    return { ok: found > 0, metrics, raw, error: found > 0 ? null : "no metrics readable on page" };
  } finally {
    await context.close().catch(() => {});
  }
}

async function runPass() {
  log("sync pass starting");

  const { targets } = await callIngest({ action: "targets" });
  if (!targets?.length) {
    log("no cTrader accounts with an investor link — nothing to do");
    return;
  }
  log(`${targets.length} account(s) to sync`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    for (const target of targets) {
      try {
        const result = await scrapeOne(browser, target);
        await callIngest({
          action: "ingest",
          credential_id: target.credential_id,
          ok: result.ok,
          metrics: result.metrics,
          raw: result.raw,
          error: result.error,
        });
      } catch (err) {
        log(`  ${target.account_label || target.credential_id}: FAILED — ${err.message}`);
        await callIngest({
          action: "ingest",
          credential_id: target.credential_id,
          ok: false,
          error: err.message,
        }).catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  log("sync pass finished");
}

async function main() {
  await runPass().catch((e) => log("pass error:", e.message));
  if (RUN_ONCE) return;

  setInterval(() => {
    runPass().catch((e) => log("pass error:", e.message));
  }, INTERVAL_MS);

  log(`worker running — next pass in ${INTERVAL_MS / 60000} min`);
}

main();
