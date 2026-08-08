# cTrader stats worker

Keeps `ctrader_snapshots` filled so the trader dashboard shows native analytics
cards and an equity curve, using nothing but the public **investor link**.

This cannot run inside Lovable/edge functions — the investor page is a
JavaScript app that streams its numbers over a socket, so a real browser has to
render it. That needs an always-on host.

## Deploy on Render (5 minutes)

1. Push this repo to GitHub (the `ctrader-worker/` folder ships with it).
2. Render → **New → Background Worker** (a Web Service also works).
3. Settings:
   - **Root Directory:** `ctrader-worker`
   - **Runtime:** Docker (uses the included `Dockerfile`, which already has
     Chromium — do *not* use the plain Node runtime, Playwright's browser
     download will fail there)
4. Environment variables:

   | Key | Value |
   |---|---|
   | `INGEST_URL` | `https://rpshiyvndmnogbhbgmfm.functions.supabase.co/ctrader-ingest` |
   | `CTRADER_INGEST_SECRET` | the exact same value saved in the app's backend secrets |
   | `SYNC_INTERVAL_MINUTES` | `10` (optional) |

5. Deploy. Logs should read `N account(s) to sync` then `X metrics` per account.

## Test locally

```bash
cd ctrader-worker
npm install
npx playwright install chromium
INGEST_URL=... CTRADER_INGEST_SECRET=... npm run once
```

`npm run once` does a single pass and exits — the fastest way to confirm a newly
pasted investor link is readable.

## Troubleshooting

The worker writes its outcome per account into `ctrader_sync_state`, and the
dashboard surfaces it. Common `last_error` values:

- `investor page rendered empty — link is invalid, expired or revoked`
  → the trader turned Investor Access off in cTrader, or the link was mistyped.
- `no metrics readable on page` → the page loaded but the labels did not match.
  The full rendered text is saved in `ctrader_snapshots.raw.body_excerpt`; send
  it over and the label map in `index.js` (`LABEL_MAP`) can be extended in a
  minute.

`LABEL_MAP` is the only place that needs touching to support a new broker's
wording — everything else is generic.
