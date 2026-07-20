# Blog Engine (Render service)

Writes SEO articles with Claude, tracks token cost, enforces spend caps, and can
auto-publish a fresh post on a schedule. Runs as one small Node service so every
secret lives in **Render environment variables** (never in the frontend bundle).

## Deploy

1. Render → **New → Blueprint** → connect this repo (it reads `render.yaml`).
2. Set these when prompted:

| Variable | What to put |
|---|---|
| `ANTHROPIC_API_KEY` | your Claude API key |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `CORS_ORIGIN` | your site origin, e.g. `https://fundingpulze.com` |

3. Deploy. Check `https://<service>.onrender.com/health` returns `{ ok: true }`.
4. In the site's build env, set `VITE_BLOG_ENGINE_URL` to that service URL.

## Optional knobs (already have sane defaults)

| Variable | Default | Meaning |
|---|---|---|
| `BLOG_ENGINE_MODEL` | `claude-3-7-sonnet-20250219` | writer model |
| `BLOG_ENGINE_IDEATE_MODEL` | `claude-3-5-haiku-20241022` | topic ideation model |
| `BLOG_ENGINE_DAILY_CAP` | `10` | max posts per UTC day |
| `BLOG_ENGINE_DAILY_USD_CAP` | `0.45` | max AI spend per day |
| `BLOG_ENGINE_PER_BLOG_USD_CAP` | `0.10` | max spend per post (sizes the article) |
| `AUTO_PUBLISH_CRON` | `0 9 * * *` | when the timer runs (UTC) |

## Endpoints

- `GET  /health` — status.
- `POST /api/generate` — admin only. Body `{ topic, primary_keyword, secondary_keywords, training_context }`.
- `POST /api/auto-publish` — admin only. Runs the timer once, now (useful to test).

Both admin routes require the caller's Supabase access token and an `admin` row
in `user_roles`. The auto-publish timer also runs on its own schedule.

## Auto-pilot

Turn it on from **Admin → Blog → Auto-pilot** (brand voice, themes, on/off).
Nothing is hardcoded — the engine writes in whatever brand voice you set there.
