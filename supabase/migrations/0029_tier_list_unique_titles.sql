-- No two saved lists in the same category may share a name.
--
-- Names are the only thing that tells saved lists apart on the index, so
-- two called "Week 10 Reset" are two rows you cannot choose between. The
-- client checks before it inserts, but that check and the insert are not
-- atomic - two quick saves, or two tabs, can both pass it - so the rule
-- belongs here as well.
--
-- Case- and space-insensitive, because "week 10 reset" and "Week 10 Reset "
-- are the same name to a human, and it is humans doing the telling apart.
--
-- A unique INDEX rather than a constraint: constraints cannot be built on
-- expressions. Scoped per (user, template), so different people - and
-- different categories - are free to reuse a name.
create unique index if not exists tier_lists_unique_title_per_template
  on public.tier_lists (user_id, template, lower(btrim(title)));
