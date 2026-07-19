# generate-seo-blog

AI blog generator (Claude). Writes an SEO-optimized article + metadata from a
topic and keyword, logs token cost, and enforces daily / per-post spend caps.

## Setup — the only required secret

Set one Supabase Edge Function secret:

```
ANTHROPIC_API_KEY=sk-ant-...
```

That's it. Everything else has sane defaults and is optional to override:

| Secret | Default | Meaning |
|---|---|---|
| `BLOG_ENGINE_MODEL` | `claude-3-7-sonnet-20250219` | writer model |
| `BLOG_ENGINE_PRICE_IN` | `3` | USD / 1M input tokens |
| `BLOG_ENGINE_PRICE_OUT` | `15` | USD / 1M output tokens |
| `BLOG_ENGINE_DAILY_CAP` | `10` | max posts per UTC day |
| `BLOG_ENGINE_DAILY_USD_CAP` | `0.45` | max AI spend per day |
| `BLOG_ENGINE_PER_BLOG_USD_CAP` | `0.10` | max AI spend per post (sizes the article) |

Brand voice/facts are passed at request time via `training_context` — nothing is
hardcoded. Usage + cost are recorded in `blog_engine_usage` and shown in the admin.
