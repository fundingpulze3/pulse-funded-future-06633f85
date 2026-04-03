SELECT cron.schedule(
  'sync-to-external-supabase-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rpshiyvndmnogbhbgmfm.supabase.co/functions/v1/sync-to-external-supabase',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwc2hpeXZuZG1ub2diaGJnbWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NzYyOTIsImV4cCI6MjA4ODM1MjI5Mn0.6D_cf0IWQF_OFXOA01w26IRhXIbIai-anpWT2F1o_uY'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'migrate-to-mongodb-every-72h',
  '0 0 */3 * *',
  $$
  SELECT net.http_post(
    url := 'https://rpshiyvndmnogbhbgmfm.supabase.co/functions/v1/migrate-to-mongodb',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwc2hpeXZuZG1ub2diaGJnbWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NzYyOTIsImV4cCI6MjA4ODM1MjI5Mn0.6D_cf0IWQF_OFXOA01w26IRhXIbIai-anpWT2F1o_uY'
    ),
    body := '{}'::jsonb
  );
  $$
);