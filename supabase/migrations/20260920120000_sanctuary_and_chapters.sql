-- Sanctuary (精神圣所) and 1000-day chapters.
--
-- Privacy posture follows 20260822090000_private_records_only.sql: a sanctuary is
-- private until its owner publishes it, and this migration grants nothing to anon.
-- Two consequences of that posture are deliberate and load bearing:
--   * is_public defaults to false, and turning it on is the only way another account
--     can read an epitaph or a creed.
--   * guest display names and the tribute counter are decided server side, so a
--     caller cannot sign a tribute as somebody else or inflate a counter.

-- A tribute kind is a closed set; use a type instead of an unvalidated varchar.
do $$ begin
  create type public.sanctuary_tribute_kind as enum ('spark', 'flower');
exception when duplicate_object then null; end $$;

create table if not exists public.sanctuary_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  epitaph text not null default '步履不停，终归星河。'
    check (char_length(btrim(epitaph)) <= 200),
  creed_1 text not null default '' check (char_length(btrim(creed_1)) <= 200),
  creed_2 text not null default '' check (char_length(btrim(creed_2)) <= 200),
  creed_3 text not null default '' check (char_length(btrim(creed_3)) <= 200),
  -- Maintained only by sanctuary_tributes_count(). No client column grant exists
  -- for it, so an owner cannot write to their own counter.
  tribute_count integer not null default 0 check (tribute_count >= 0),
  -- Opt-in only. Nothing in this migration makes a sanctuary readable by default.
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.sanctuary_profiles.is_public is 'Opt-in publication. False means only the owner can read this row; the owner must turn it on explicitly.';
comment on column public.sanctuary_profiles.tribute_count is 'Derived counter kept by trigger. Not writable by clients at any privilege level.';

create table if not exists public.sanctuary_tributes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid not null references auth.users(id) on delete cascade,
  -- Overwritten by sanctuary_apply_tribute_rules() before the row is stored.
  guest_name text not null default '同行者'
    check (char_length(btrim(guest_name)) between 1 and 64),
  tribute_kind public.sanctuary_tribute_kind not null default 'spark',
  message text not null default '' check (char_length(btrim(message)) <= 200),
  created_at timestamptz not null default now(),
  constraint sanctuary_tributes_no_self check (guest_user_id <> target_user_id)
);

create index if not exists sanctuary_tributes_target_idx
  on public.sanctuary_tributes(target_user_id, created_at desc, id);
create index if not exists sanctuary_tributes_guest_idx
  on public.sanctuary_tributes(guest_user_id, created_at desc);

-- Guest write budget. Mirrors the wechat_auth_limits / wechat_auth_allow pair:
-- the counter lives in a table no client role can reach, and only the definer
-- function below touches it.
create table if not exists public.sanctuary_tribute_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  used integer not null default 0 check (used >= 0)
);

-- Guest identity plus write budget. security definer is required because the guest
-- holds no privilege on sanctuary_tribute_limits; search_path is pinned and every
-- name is schema qualified so the definer context cannot be hijacked.
create or replace function public.sanctuary_apply_tribute_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_used integer;
begin
  if new.guest_user_id = new.target_user_id then
    raise exception 'A sanctuary owner cannot leave a tribute on their own sanctuary';
  end if;

  -- The caller never chooses the signature. Ignore whatever the client sent and
  -- read the guest's own profile instead.
  select nullif(btrim(coalesce(p.display_name, '')), '') into v_name
  from public.profiles p where p.id = new.guest_user_id;
  new.guest_name = coalesce(v_name, '同行者');

  -- An empty note is a legitimate tribute, a whitespace-only one is not. Normalise
  -- here so the length check below measures the stored value.
  new.message = btrim(coalesce(new.message, ''));

  insert into public.sanctuary_tribute_limits as l (bucket, window_started_at, used)
  values (new.guest_user_id::text, now(), 1)
  on conflict (bucket) do update set
    used = case when l.window_started_at <= now() - interval '1 hour' then 1 else l.used + 1 end,
    window_started_at = case when l.window_started_at <= now() - interval '1 hour' then now() else l.window_started_at end
  returning l.used into v_used;

  -- 20 tributes per guest per rolling hour, across every sanctuary.
  if v_used > 20 then
    raise exception 'Too many tributes from this account, please try again later';
  end if;

  return new;
end;
$$;

create or replace function public.sanctuary_count_tribute()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.sanctuary_profiles
  set tribute_count = tribute_count + 1, updated_at = now()
  where user_id = new.target_user_id;
  return null;
end;
$$;

drop trigger if exists sanctuary_tributes_apply_rules on public.sanctuary_tributes;
create trigger sanctuary_tributes_apply_rules before insert on public.sanctuary_tributes
for each row execute function public.sanctuary_apply_tribute_rules();

drop trigger if exists sanctuary_tributes_count on public.sanctuary_tributes;
create trigger sanctuary_tributes_count after insert on public.sanctuary_tributes
for each row execute function public.sanctuary_count_tribute();

drop trigger if exists sanctuary_profiles_set_updated_at on public.sanctuary_profiles;
create trigger sanctuary_profiles_set_updated_at before update on public.sanctuary_profiles
for each row execute function public.set_updated_at();

alter table public.sanctuary_profiles enable row level security;
alter table public.sanctuary_tributes enable row level security;
alter table public.sanctuary_tribute_limits enable row level security;

-- Owner reads and writes their own row.
drop policy if exists "sanctuary_profiles_select_own" on public.sanctuary_profiles;
create policy "sanctuary_profiles_select_own" on public.sanctuary_profiles
for select to authenticated using ((select auth.uid()) = user_id);

-- Other accounts read a row only after its owner opted in. No policy here targets
-- anon, so an unauthenticated caller cannot read an epitaph or a creed.
drop policy if exists "sanctuary_profiles_select_published" on public.sanctuary_profiles;
create policy "sanctuary_profiles_select_published" on public.sanctuary_profiles
for select to authenticated using (is_public = true);

drop policy if exists "sanctuary_profiles_insert_own" on public.sanctuary_profiles;
create policy "sanctuary_profiles_insert_own" on public.sanctuary_profiles
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "sanctuary_profiles_update_own" on public.sanctuary_profiles;
create policy "sanctuary_profiles_update_own" on public.sanctuary_profiles
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "sanctuary_profiles_delete_own" on public.sanctuary_profiles;
create policy "sanctuary_profiles_delete_own" on public.sanctuary_profiles
for delete to authenticated using ((select auth.uid()) = user_id);

-- The guest sees what they wrote; the host sees what was left for them; everyone
-- else sees the wall only while the sanctuary is published.
drop policy if exists "sanctuary_tributes_select_visible" on public.sanctuary_tributes;
create policy "sanctuary_tributes_select_visible" on public.sanctuary_tributes
for select to authenticated using (
  guest_user_id = (select auth.uid())
  or target_user_id = (select auth.uid())
  or exists (
    select 1 from public.sanctuary_profiles p
    where p.user_id = target_user_id and p.is_public = true
  )
);

-- A tribute can only be written by the guest themselves, never onto their own
-- sanctuary, and only onto a sanctuary its owner has published.
drop policy if exists "sanctuary_tributes_insert_guest" on public.sanctuary_tributes;
create policy "sanctuary_tributes_insert_guest" on public.sanctuary_tributes
for insert to authenticated with check (
  guest_user_id = (select auth.uid())
  and guest_user_id <> target_user_id
  and exists (
    select 1 from public.sanctuary_profiles p
    where p.user_id = target_user_id and p.is_public = true
  )
);

drop policy if exists "sanctuary_tributes_delete_own" on public.sanctuary_tributes;
create policy "sanctuary_tributes_delete_own" on public.sanctuary_tributes
for delete to authenticated using (guest_user_id = (select auth.uid()));

-- An owner can clear abuse from their own wall.
drop policy if exists "sanctuary_tributes_delete_host" on public.sanctuary_tributes;
create policy "sanctuary_tributes_delete_host" on public.sanctuary_tributes
for delete to authenticated using (target_user_id = (select auth.uid()));

revoke all on public.sanctuary_profiles from public, anon, authenticated, service_role;
revoke all on public.sanctuary_tributes from public, anon, authenticated, service_role;
revoke all on public.sanctuary_tribute_limits from public, anon, authenticated, service_role;

-- Column level grants keep the counter and the signature out of client reach even
-- for the row's own owner.
grant select on public.sanctuary_profiles to authenticated;
grant insert (user_id, epitaph, creed_1, creed_2, creed_3, is_public)
  on public.sanctuary_profiles to authenticated;
-- Only the authored fields. user_id stays ungranted so an upsert cannot rewrite the
-- primary key, and updated_at is owned by the BEFORE UPDATE trigger.
grant update (epitaph, creed_1, creed_2, creed_3, is_public)
  on public.sanctuary_profiles to authenticated;
grant delete on public.sanctuary_profiles to authenticated;

grant select on public.sanctuary_tributes to authenticated;
-- The id is granted so a retried tribute reuses its client generated key and collapses
-- into the existing row instead of posting twice. guest_name is deliberately absent.
grant insert (id, target_user_id, guest_user_id, tribute_kind, message)
  on public.sanctuary_tributes to authenticated;
grant delete on public.sanctuary_tributes to authenticated;

-- Trigger functions stay off the anon role. Installed triggers keep firing
-- regardless of EXECUTE, which is what lets the definer body do its work.
revoke all on function public.sanctuary_apply_tribute_rules() from public, anon;
revoke all on function public.sanctuary_count_tribute() from public, anon;
grant execute on function public.sanctuary_apply_tribute_rules() to authenticated, service_role;
grant execute on function public.sanctuary_count_tribute() to authenticated, service_role;

-- Note: the encrypted capsule (胶囊) is intentionally absent here. public.future_letters
-- already models a sealed letter with deliver_at and status, so a second capsule schema
-- would be a duplicate source of truth. Wire the capsule UI to future_letters.
