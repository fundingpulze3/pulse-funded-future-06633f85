-- Auto-end competitions once their end date passes, and refresh every
-- participant's leaderboard stats server-side (not just the logged-in
-- user's own entry), every 10 minutes.
SELECT cron.schedule(
  'sync-competitions-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rpshiyvndmnogbhbgmfm.supabase.co/functions/v1/sync-competitions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwc2hpeXZuZG1ub2diaGJnbWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NzYyOTIsImV4cCI6MjA4ODM1MjI5Mn0.6D_cf0IWQF_OFXOA01w26IRhXIbIai-anpWT2F1o_uY'
    ),
    body := '{}'::jsonb
  );
  $$
);
