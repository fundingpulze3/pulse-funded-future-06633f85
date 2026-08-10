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
 * Label mapping — calibrated against the live cTrader investor page
 * (Summary + Performance stats + bottom account bar).
 * ------------------------------------------------------------------ */
const LABEL_MAP = [
  [/^net profit$/, "profit"],
  [/^profit factor$/, "profit_factor"],
  [/^profitability percentage$/, "win_rate"],
  [/^max balance drawdown$/, "max_drawdown_percent"],
  [/^(current balance|balance)$/, "balance"],
  [/^equity$/, "equity"],
  [/^deposits?$/, "deposits"],
  [/^(used margin|margin)$/, "margin_used"],
  [/^total deals$/, "total_trades"],
  [/^winning deals$/, "winning_trades"],
  [/^losing deals$/, "losing_trades"],
  [/^positions$/, "open_positions_count"],
  // generic fallbacks kept for other brokers' wording
  [/^(roi|return|gain|growth)$/, "roi_percent"],
  [/^(win rate|% profitable)$/, "win_rate"],
  [/^(average win|avg\.? win)$/, "avg_win"],
  [/^(average loss|avg\.? loss)$/, "avg_loss"],
  [/^(best trade|largest win)$/, "best_trade"],
  [/^(worst trade|largest loss)$/, "worst_trade"],
];

const PERCENT_FIELDS = new Set(["roi_percent", "win_rate", "max_drawdown_percent"]);

function parseNumber(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  // "0 (0.00%)" -> take the leading count, drop the bracketed share
  s = s.replace(/\(([^)]*)\)\s*$/, (m, inner) => (/%/.test(inner) ? "" : m)).trim();

  const negative = /^[-−(]/.test(s);
  const currency = (s.match(/\b[A-Z]{3}\b|[$€£¥₹]/) || [])[0] || null;
  s = s.replace(/[()]/g, "").replace(/−/g, "-");
  s = s.replace(/[^0-9.,\-\s]/g, "");
  // cTrader uses a space as the thousands separator: "EUR 1 000.00"
  s = s.replace(/(?<=\d)[\s ](?=\d)/g, "").replace(/\s/g, "");
  if (!s || !/[0-9]/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return { value: negative && n > 0 ? -n : n, currency };
}

const normCurrency = (c) => {
  if (!c) return null;
  if (/^[A-Z]{3}$/.test(c)) return c;
  return { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY" }[c] || null;
};

/**
 * The investor page renders each stat as "Label" on one line and its value on
 * the next, so pairing consecutive lines of the rendered text is both simpler
 * and far more reliable than walking the DOM.
 */
function extractPairs(bodyText) {
  const lines = bodyText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const pairs = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = lines[i];
    const value = lines[i + 1];
    if (label.length > 40 || /\d/.test(label)) continue;
    if (value.length > 30 || !/\d/.test(value)) continue;
    pairs.push({ label: label.replace(/[:*]/g, "").trim(), value });
  }
  return pairs;
}

function mapPairs(pairs, bodyText) {
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

    // "4 (8.89%)" is a count with its share in brackets — only a bare
    // percentage disqualifies a non-percentage field.
    const isPct = value.replace(/\([^)]*\)\s*$/, "").includes("%");
    if (!PERCENT_FIELDS.has(field) && isPct) continue;


    metrics[field] = parsed.value;
    const ccy = normCurrency(parsed.currency);
    if (ccy && !metrics.currency) metrics.currency = ccy;
  }

  // Account header: "Demo - 5776607 - Hedging - EUR - 1:100"
  const acct = bodyText.match(/Account:\s*\n?\s*(.{3,80})/);
  if (acct) metrics.account_name = acct[1].trim();
  if (!metrics.currency) {
    const ccy = (bodyText.match(/\b(USD|EUR|GBP|INR|JPY|AUD|CAD|CHF)\b/) || [])[1];
    if (ccy) metrics.currency = ccy;
  }

  // Derive whatever the page does not spell out.
  if (metrics.equity == null && metrics.balance != null) metrics.equity = metrics.balance;
  if (metrics.win_rate == null && metrics.winning_trades != null && metrics.total_trades > 0) {
    metrics.win_rate = Number(((metrics.winning_trades / metrics.total_trades) * 100).toFixed(2));
  }
  if (metrics.roi_percent == null && metrics.profit != null && metrics.deposits > 0) {
    metrics.roi_percent = Number(((metrics.profit / metrics.deposits) * 100).toFixed(2));
  }
  metrics.period = "all";

  return { metrics, raw };
}


async function scrapeOne(browser, target) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Spotware's app boots by resolving a proxy list from *.ctradercloud.com. When
  // that infrastructure is unreachable the page sits on its spinner forever, so we
  // record those failures explicitly instead of reporting a meaningless empty page.
  const blockedHosts = new Set();
  page.on("requestfailed", (req) => {
    try {
      const host = new URL(req.url()).hostname;
      if (/ctradercloud\.com$/.test(host)) blockedHosts.add(host);
    } catch {}
  });

  try {
    const url = `https://ct.spotware.com/investor/${encodeURIComponent(target.token)}?lang=en&theme=dark`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

    // The numbers arrive over a socket after the link authenticates, so poll for
    // the Summary panel rather than betting on one fixed sleep. One reload is
    // attempted if the first boot stalls on the loading spinner.
    let bodyText = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const deadline = Date.now() + Math.max(SETTLE_MS, 40000);
      while (Date.now() < deadline) {
        await page.waitForTimeout(2000);
        bodyText = (await page.innerText("body").catch(() => "")).trim();
        if (/Profit factor/i.test(bodyText)) break;
      }
      if (/Profit factor/i.test(bodyText)) break;
      if (attempt === 0) {
        log(`  ${target.account_label || target.credential_id}: still loading, retrying once`);
        await page.reload({ waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS }).catch(() => {});
      }
    }

    if (!bodyText) {
      if (blockedHosts.size) {
        throw new Error(
          `cTrader backend unreachable from this host (${[...blockedHosts].join(", ")}) — the investor page never finished loading`,
        );
      }
      throw new Error("investor page rendered empty — link is invalid, expired or revoked");
    }
    if (/not found|no longer available|invalid|expired|revoked/i.test(bodyText.slice(0, 400))) {
      throw new Error(`investor page reports: ${bodyText.slice(0, 160)}`);
    }

    // The Summary panel follows the ROI period tabs — switch to "All" so the
    // stored snapshot always reflects the whole account history.
    try {
      const all = page.getByText("All", { exact: true }).first();
      await all.click({ timeout: 5000 });
      await page.waitForTimeout(4000);
      bodyText = (await page.innerText("body").catch(() => bodyText)).trim();
    } catch {}

    const pairs = extractPairs(bodyText);
    const { metrics, raw } = mapPairs(pairs, bodyText);
    raw.body_excerpt = bodyText.slice(0, 2000);
    if (blockedHosts.size) raw.blocked_hosts = [...blockedHosts];


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
