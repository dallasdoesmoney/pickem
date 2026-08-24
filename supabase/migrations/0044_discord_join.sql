-- 250 points, once ever, for joining the Discord.
--
-- WHAT THIS CAN AND CANNOT CHECK. It cannot check that you joined. The
-- app has no Discord identity for anyone, so there is nothing to compare
-- a guild membership against; this pays for following the invite link,
-- and someone who opens it and closes the tab is paid the same as someone
-- who stays. That is a deliberate trade at 250 points - ten days of
-- checking in - because the alternative is a Discord OAuth app, a bot
-- with guild-members intent, and a stored discord_id per user, which is a
-- real feature rather than a line of SQL.
--
-- What it DOES guarantee is that it pays once. The unique index on
-- (user_id, source, reference_id) is what enforces that, not the client -
-- a fixed reference_id means a second call is a no-op no matter how many
-- times the button is pressed or how many tabs are open.
--
-- If this ever gets abused, the upgrade path is to leave this function in
-- place and add the membership check to it; the ledger rows do not change
-- shape.

create or replace function public.claim_discord_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in step with src/data/achievements.ts's discord_join pointsEach.
  v_points constant integer := 250;
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  -- 'joined' rather than a timestamp or a nonce: the reference_id IS the
  -- once-ness here, so it has to be a value the caller cannot vary.
  insert into public.point_events (user_id, source, points, reference_id)
  values (v_uid, 'discord_join', v_points, 'joined')
  on conflict (user_id, source, reference_id) do nothing;
  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'awarded', v_rows > 0,
    'points', case when v_rows > 0 then v_points else 0 end
  );
end;
$$;

revoke all on function public.claim_discord_join() from public;
grant execute on function public.claim_discord_join() to authenticated;
