-- Is this database ready for the pick reminder?
--
-- Read-only. Safe against production, safe to run repeatedly.
--
-- Catalog lookups only, deliberately: it asks Postgres what exists
-- rather than querying the tables themselves, so it returns a full
-- report even when nothing has been installed yet instead of dying on
-- the first missing table.

select * from (values

  -- 0052 creates two tables. Both, or neither.
  ('email_prefs table',
   case when to_regclass('public.email_prefs') is not null
        then 'ok' else 'MISSING - run 0052' end),

  ('email_sends table',
   case when to_regclass('public.email_sends') is not null
        then 'ok' else 'MISSING - run 0052' end),

  -- The two columns added AFTER 0052 was first written, when the
  -- question turned to open rates. This is the check that catches an
  -- early copy of the file: the tables are there and everything looks
  -- installed, but there is nowhere to record the provider's message id
  -- or how far through their card somebody was.
  ('...with the stats columns',
   case when to_regclass('public.email_sends') is null then '- run 0052 first'
        when exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'email_sends'
                        and column_name in ('provider_message_id', 'picks_at_send')
                      having count(*) = 2)
        then 'ok' else 'STALE COPY - re-run 0052' end),

  ('recipient function',
   case when to_regprocedure('public.weekly_deadline_recipients(text,integer,integer)') is not null
        then 'ok' else 'MISSING - run 0052' end),

  -- jsonb, not the uuid[] the first version took. An old signature here
  -- means the sender will record nothing.
  ('record-sent function (jsonb form)',
   case when to_regprocedure('public.mark_emails_sent(text,text,text,jsonb)') is not null
        then 'ok' else 'MISSING or OLD SIGNATURE - re-run 0052' end),

  ('unsubscribe function',
   case when to_regprocedure('public.email_unsubscribe(uuid)') is not null
        then 'ok' else 'MISSING - run 0052' end),

  -- The token the GitHub job authenticates with. Its VALUE is not shown -
  -- only whether a row exists.
  ('email_sender token',
   case when to_regclass('public.sync_secrets') is null then 'sync_secrets missing - run 0039'
        when exists (select 1 from public.sync_secrets where name = 'email_sender')
        then 'ok' else 'MISSING - see step 4' end),

  -- Untouched by any of this, and worth seeing stay green.
  ('game_results token (results sync)',
   case when to_regclass('public.sync_secrets') is null then 'sync_secrets missing - run 0039'
        when exists (select 1 from public.sync_secrets where name = 'game_results')
        then 'ok' else 'missing' end),

  -- Not a failure. The sender exits early when no week is open, so an
  -- hourly cron stays quiet and green until somebody opens one.
  ('a week open to remind about',
   case when to_regclass('public.weeks') is null then 'weeks missing'
        when exists (select 1 from public.weeks where is_open)
        then 'yes - reminders can fire'
        else 'none open - the job will say "No week is open" and pass' end),

  -- Nobody is opted in until somebody flips the toggle, so the first
  -- real run finding zero recipients is correct rather than broken.
  -- Counted through query_to_xml rather than by selecting from the table
  -- directly. Postgres resolves a table name when it PARSES the
  -- statement, before any CASE can guard it, so naming email_prefs here
  -- made the whole report fail with "relation does not exist" on exactly
  -- the database that most needs the report. query_to_xml takes its query
  -- as a string, so it is only resolved if the branch is reached.
  ('people opted in',
   case when to_regclass('public.email_prefs') is null then '- run 0052 first'
        else (xpath('/row/c/text()', query_to_xml(
                $q$select count(*) filter (where weekly_deadline) || ' of ' || count(*) || ' accounts' as c
                     from public.email_prefs$q$, false, true, '')))[1]::text end)

) as t(check_name, status);
