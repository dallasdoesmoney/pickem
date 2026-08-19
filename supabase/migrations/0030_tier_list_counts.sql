-- How many people have ranked each category, for the hub's cards.
--
-- It has to be an RPC. tier_lists is under RLS that limits every reader
-- to their own rows, which is correct and stays that way - a plain
-- count(*) from the client would only ever return your own lists. This
-- runs as definer so it can see across users, and returns nothing but a
-- template slug and a number: no titles, no ids, no boards.
--
-- Counts DISTINCT user_id, not rows. Saving five NFL lists makes you one
-- person who ranked the NFL, which is what the card claims.
create or replace function public.tier_list_rank_counts()
returns table (template text, people bigint)
language sql
security definer
set search_path = public
stable
as $$
  select template, count(distinct user_id)::bigint
  from public.tier_lists
  group by template;
$$;

revoke all on function public.tier_list_rank_counts() from public;
grant execute on function public.tier_list_rank_counts() to anon, authenticated;
