-- Now pays both sides of a referral: the referrer still gets 1,000 (source
-- 'referral', unchanged), and the new signup also gets 1,000 (source
-- 'referral_signup') - kept as a distinct source rather than reusing
-- 'referral' so the two directions stay distinguishable in the ledger.
-- Same claim-once/no-self-referral guards as before.
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
  values
    (v_referrer_id, 'referral', 1000, auth.uid()::text),
    (auth.uid(), 'referral_signup', 1000, v_referrer_id::text)
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;
