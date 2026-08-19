-- Several saved tier lists per category, instead of one.
--
-- 0027 shipped with `unique (user_id, template)` and said dropping it was
-- all that would be needed to allow several named lists per category
-- later. This is later. A saved list is now identified by its id, which
-- the client already gets back on insert, so nothing else in the table
-- has to change: same columns, same RLS, same column-level grants, same
-- updated_at trigger.
--
-- Nothing is lost by dropping it. The constraint only ever prevented a
-- second row per (user, template); every existing row stays exactly as
-- it is and simply stops being the only one allowed.
--
-- The (user_id, updated_at desc) index from 0027 already covers the read
-- this unlocks - "my saved lists, newest first" - so no new index here.
alter table public.tier_lists
  drop constraint if exists tier_lists_user_id_template_key;

-- Titles are how you tell saved lists apart now that there can be more
-- than one per category, so an empty one is no longer a cosmetic issue.
-- The client defaults and trims, but it is not the only possible writer.
alter table public.tier_lists
  add constraint tier_lists_title_not_blank check (length(btrim(title)) > 0);
