-- Tier lists: a saved, editable list per account per template, plus
-- immutable public snapshots for sharing.
--
-- Two tables rather than one because they have opposite lifecycles. A
-- tier_lists row is mutable and private-ish (the author keeps editing
-- it); a tier_list_shares row must never change after it's created, or
-- everyone who was sent a link would see the author's later edits
-- instead of what was actually shared.
--
-- The shares table is also the first thing in this schema an ANONYMOUS
-- visitor can cause a write to - you don't need an account to share a
-- tier list. That's deliberately NOT done by granting anon insert (no
-- table here has ever allowed that, and unrestricted client writes are
-- exactly what the column-grant convention exists to prevent). Instead
-- the table has no insert grant at all and the only writer is
-- create_tier_list_share() below, a security-definer function that
-- validates shape and size before it inserts - same posture as
-- notifications/point_events, and the same `grant execute to anon` the
-- public_* read RPCs already use.

create table public.tier_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null,
  title text not null,
  -- tiers, placements and unranked order in one blob. Deliberately not
  -- normalised into rows: it's always read and written whole, it's never
  -- queried across, and tier definitions are user-editable so there's no
  -- stable dimension to join against.
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One saved list per template for now, so Save is a plain upsert.
  -- Dropping this constraint is all that's needed to allow several named
  -- lists per category later.
  unique (user_id, template)
);
create index tier_lists_user_idx on public.tier_lists (user_id, updated_at desc);
alter table public.tier_lists enable row level security;

create policy "tier_lists_select_own" on public.tier_lists for select using (auth.uid() = user_id);
revoke insert, update on public.tier_lists from authenticated;
grant insert (user_id, template, title, state) on public.tier_lists to authenticated;
-- updated_at is not client-settable; the trigger below owns it, so a
-- stale or forged timestamp can't be written.
grant update (title, state) on public.tier_lists to authenticated;
grant delete on public.tier_lists to authenticated;
create policy "tier_lists_insert_own" on public.tier_lists for insert with check (auth.uid() = user_id);
create policy "tier_lists_update_own" on public.tier_lists for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tier_lists_delete_own" on public.tier_lists for delete using (auth.uid() = user_id);

create or replace function public.touch_tier_list_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger tier_lists_touch_updated_at
  before update on public.tier_lists
  for each row execute function public.touch_tier_list_updated_at();

-- Immutable snapshots. user_id is nullable (anonymous shares) and
-- `on delete set null` rather than cascade: someone deleting their
-- account shouldn't break links other people are already holding.
create table public.tier_list_shares (
  code text primary key,
  user_id uuid references auth.users(id) on delete set null,
  template text not null,
  title text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);
create index tier_list_shares_user_idx on public.tier_list_shares (user_id, created_at desc);
alter table public.tier_list_shares enable row level security;

-- Anyone with the link can read it, signed in or not - that's the whole
-- point of a share link.
create policy "tier_list_shares_select_all" on public.tier_list_shares for select using (true);
grant select on public.tier_list_shares to anon, authenticated;
-- No insert/update/delete grant to anyone. create_tier_list_share() is
-- the only path in, and nothing may edit a snapshot after the fact.

-- Short, unambiguous codes (no 0/o/1/l/i) so they survive being read
-- aloud or retyped off a screenshot. Retries on the astronomically
-- unlikely collision rather than trusting a single draw.
create or replace function public.gen_tier_share_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.tier_list_shares where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- The only writer into tier_list_shares. Validates before inserting so a
-- crafted client can't use anonymous sharing as free unbounded storage.
create or replace function public.create_tier_list_share(p_template text, p_title text, p_state jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if p_template is null or length(p_template) > 40 then
    raise exception 'Invalid template';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Invalid state';
  end if;
  if jsonb_typeof(p_state -> 'tiers') <> 'array' or jsonb_array_length(p_state -> 'tiers') > 10 then
    raise exception 'Invalid tiers';
  end if;
  -- Hard ceiling on the blob. A legitimate 32-item list with 10 tiers is
  -- well under 4KB; this only ever catches abuse.
  if pg_column_size(p_state) > 20000 then
    raise exception 'State too large';
  end if;

  v_code := public.gen_tier_share_code();
  insert into public.tier_list_shares (code, user_id, template, title, state)
  values (v_code, auth.uid(), p_template, left(coalesce(nullif(trim(p_title), ''), 'Tier List'), 60), p_state);
  return v_code;
end;
$$;
grant execute on function public.create_tier_list_share(text, text, jsonb) to anon, authenticated;
