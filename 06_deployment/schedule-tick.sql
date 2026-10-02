-- PlantPal+ scheduled work on Supabase: pg_cron calls the API's
-- POST /internal/tick every five minutes, which runs the reminder pass and the
-- FR-ACC-22 erasure sweep (see "Scheduled work" in 06_deployment/README.md).
--
-- Run once per project, in the SQL editor, after `plantpal-api` is deployed.
-- Safe to re-run: the secret is created only if it is missing, and the job is
-- replaced rather than duplicated.
--
-- The bearer secret is generated here, inside the database, and stored in
-- Vault. The job reads it from Vault at run time and the function reads the
-- same entry (03_implementation/api/edge/index.ts), so it never has to be copied anywhere —
-- and this script never prints it.
--
-- Deploying to another project? Replace the project reference in the URL.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'plantpal_tick_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'plantpal_tick_secret',
      'Bearer secret pg_cron presents to plantpal-api /internal/tick'
    );
  end if;
end
$$;

-- Replace any earlier version of the job.
select cron.unschedule(jobid) from cron.job where jobname = 'plantpal-tick';

select cron.schedule(
  'plantpal-tick',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://mmqqijfgtcjviogqporc.supabase.co/functions/v1/plantpal-api/internal/tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'plantpal_tick_secret'
           limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
