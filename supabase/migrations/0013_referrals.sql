-- referred_by has no client update grant (see profiles' column-level
-- lockdown) - it's only ever set by claim_referral() below, never a
-- direct client update, so nobody can backdate/reassign who referred them
-- to farm points for a friend after the fact.
alter table public.profiles add column referred_by uuid references auth.users(id);

-- Attributes a new signup to whoever referred them (by username, doubling
-- as the referral code - no separate code system needed) and pays the
-- referrer a flat, deliberately large bonus. Security definer since
-- referred_by has no client update grant. Claimable exactly once per
-- account: a caller who already has referred_by set is a no-op, which
-- also makes this safe to call speculatively/repeatedly from the client
-- without double-crediting. No-ops on a bad username or a self-referral
-- rather than erroring, since this runs silently in the background after
-- signup - there's no UI waiting on its result.
create or replace function public.claim_referral(p_referrer_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and referred_by is not null) then
    return;
  end if;

  select id into v_referrer_id from public.profiles where lower(username) = lower(p_referrer_username);
  if v_referrer_id is null or v_referrer_id = auth.uid() then
    return;
  end if;

  update public.profiles set referred_by = v_referrer_id where id = auth.uid();

  insert into public.point_events (user_id, source, points, reference_id)
  values (v_referrer_id, 'referral', 1000, auth.uid()::text)
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;
