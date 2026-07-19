# blog-auto-publish (the upload timer)

On each run: if `blog_settings.auto_publish` is on and the daily caps aren't hit,
it ideates one fresh topic (cheap model), writes the article (writer model),
and publishes it — under the same per-post / daily spend caps.

## Enable

1. Set `ANTHROPIC_API_KEY` (same secret as the generator).
2. Turn it on and give it a brand voice:
   ```sql
   update public.blog_settings
     set auto_publish = true,
         brand_context = 'Who the brand is, audience, tone, non-negotiables...',
         themes = 'topic theme 1, topic theme 2, ...'
     where id = 1;
   ```
3. Schedule it (once). In the Supabase SQL editor, using pg_cron + pg_net —
   replace `<PROJECT_REF>` and paste your service-role key from the Vault:
   ```sql
   select cron.schedule(
     'blog-auto-publish-daily', '0 9 * * *',   -- 09:00 UTC daily; change cadence as you like
     $$ select net.http_post(
          url := 'https://<PROJECT_REF>.functions.supabase.co/blog-auto-publish',
          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type','application/json'),
          body := '{}'::jsonb
        ); $$
   );
   ```
   (Or add a Schedule in the Supabase dashboard pointing at this function.)
