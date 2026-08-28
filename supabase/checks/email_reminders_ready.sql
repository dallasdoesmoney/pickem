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

  -- The FOUR-argument form. 0054 dropped the three-argument version and
  -- replaced it with one that takes the reminder kind, so this check
  -- looked for a signature that is supposed to be gone and reported
  -- MISSING on a database that was entirely correct. A check that cries
  -- wolf on a healthy database is worse than no check.
  ('recipient function (kind-aware form)',
   case when to_regprocedure('public.weekly_deadline_recipients(text,integer,integer,text)') is not null
          then 'ok'
        when to_regprocedure('public.weekly_deadline_recipients(text,integer,integer)') is not null
          then 'OLD 3-ARG FORM - run 0054'
        else 'MISSING - run 0052 then 0054' end),

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
                     from public.email_prefs$q$, false, true, '')))[1]::text end),

  -- CAN THE SENDER ACTUALLY CALL THEM. Added after the first real run
  -- died on "permission denied for function weekly_deadline_recipients":
  -- 0052 and 0054 revoked EXECUTE from anon and never granted it back,
  -- so the functions existed, were correct, and were unreachable.
  --
  -- Every check above this one passed while that was true. Existing is
  -- not the same as callable, and the sender arrives through PostgREST
  -- as `anon`, so anon is the role that has to hold the privilege.
  ('sender can call weekly_deadline_recipients',
   case when to_regprocedure('public.weekly_deadline_recipients(text,integer,integer,text)') is null
          then 'function missing - run 0054'
        when has_function_privilege('anon',
               'public.weekly_deadline_recipients(text,integer,integer,text)', 'execute')
          then 'ok'
        else 'PERMISSION DENIED for anon - run 0055' end),

  ('sender can call mark_emails_sent',
   case when to_regprocedure('public.mark_emails_sent(text,text,text,jsonb)') is null
          then 'function missing - run 0052'
        when has_function_privilege('anon',
               'public.mark_emails_sent(text,text,text,jsonb)', 'execute')
          then 'ok'
        else 'PERMISSION DENIED for anon - run 0055' end),

  -- The unsubscribe link is clicked by somebody reading their email, not
  -- signed in, very likely on another device. If anon cannot execute
  -- this, every unsubscribe in every email is a dead link - which is a
  -- legal problem as well as a deliverability one.
  ('unsubscribe link works signed out',
   case when to_regprocedure('public.email_unsubscribe(uuid)') is null
          then 'function missing - run 0052'
        when has_function_privilege('anon', 'public.email_unsubscribe(uuid)', 'execute')
          then 'ok'
        else 'PERMISSION DENIED for anon - unsubscribe links are dead' end)

) as t(check_name, status);
