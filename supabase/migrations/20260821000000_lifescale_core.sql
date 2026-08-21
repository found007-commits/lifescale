create extension if not exists pgcrypto;

create type public.life_display_mode as enum ('gentle', 'clear');
create type public.entry_visibility as enum ('private', 'public');
create type public.entry_mood as enum ('calm', 'happy', 'grateful', 'tired', 'sad', 'anxious', 'hopeful');
create type public.entry_category as enum ('daily', 'family', 'work', 'growth', 'health', 'travel', 'reflection', 'other');
create type public.report_type as enum ('7d', '30d', '100d', '365d', '1000d', '10000d');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  locale text not null default 'zh' check (locale in ('zh', 'en')),
  timezone text not null default 'UTC',
  birth_date date not null,
  target_age integer check (target_age between 30 and 150),
  target_date date not null,
  target_locked_until timestamptz not null default (now() + interval '1 year'),
  actual_death_date date,
  display_mode public.life_display_mode not null default 'gentle',
  onboarding_completed boolean not null default false,
  privacy_version text not null default '2026-08-21',
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_target_after_birth check (target_date > birth_date),
  constraint actual_death_is_independent check (actual_death_date is null or actual_death_date >= birth_date)
);

comment on column public.profiles.actual_death_date is 'Independent verified legacy field. Never inferred from target_date and never set by the normal user countdown flow.';

create table public.life_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date timestamptz not null default now(),
  content text not null default '' check (char_length(content) <= 12000),
  mood public.entry_mood not null default 'calm',
  category public.entry_category not null default 'daily',
  visibility public.entry_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index life_entries_user_date_idx on public.life_entries(user_id, entry_date desc);
create index life_entries_public_idx on public.life_entries(entry_date desc) where visibility = 'public';

create table public.entry_media (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.life_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type like 'image/%'),
  created_at timestamptz not null default now()
);

create index entry_media_entry_idx on public.entry_media(entry_id);
create index entry_media_user_idx on public.entry_media(user_id);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  unique(user_id, checkin_date)
);

create index checkins_user_date_idx on public.checkins(user_id, checkin_date desc);

create table public.life_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type public.report_type not null,
  period_start date not null,
  period_end date not null,
  report_data jsonb not null default '{}'::jsonb,
  representative_entry_id uuid references public.life_entries(id) on delete set null,
  visibility public.entry_visibility not null default 'private',
  created_at timestamptz not null default now(),
  unique(user_id, report_type, period_start, period_end)
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email_hash text not null,
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.future_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  content text not null,
  deliver_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_email text not null,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'revoked')),
  created_at timestamptz not null default now(),
  unique(user_id, contact_email)
);

create table public.memorial_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  trusted_contact_id uuid references public.trusted_contacts(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'withdrawn')),
  evidence_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_profile_target_lock()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.actual_death_date is distinct from new.actual_death_date then
    raise exception 'actual_death_date cannot be changed through the normal profile flow';
  end if;
  if old.birth_date is distinct from new.birth_date
     or old.target_age is distinct from new.target_age
     or old.target_date is distinct from new.target_date then
    if now() < old.target_locked_until then
      raise exception 'Life target is locked until %', old.target_locked_until;
    end if;
    new.target_locked_until = now() + interval '1 year';
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger profiles_enforce_target_lock before update on public.profiles
for each row execute function public.enforce_profile_target_lock();
create trigger life_entries_set_updated_at before update on public.life_entries
for each row execute function public.set_updated_at();
create trigger future_letters_set_updated_at before update on public.future_letters
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.life_entries enable row level security;
alter table public.entry_media enable row level security;
alter table public.checkins enable row level security;
alter table public.life_reports enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.future_letters enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.memorial_requests enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id and actual_death_date is null);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "entries_select_own_or_public" on public.life_entries for select to authenticated using ((select auth.uid()) = user_id or visibility = 'public');
create policy "entries_insert_own" on public.life_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "entries_update_own" on public.life_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entries_delete_own" on public.life_entries for delete to authenticated using ((select auth.uid()) = user_id);

create policy "media_select_own" on public.entry_media for select to authenticated using ((select auth.uid()) = user_id);
create policy "media_insert_own" on public.entry_media for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "media_delete_own" on public.entry_media for delete to authenticated using ((select auth.uid()) = user_id);

create policy "checkins_select_own" on public.checkins for select to authenticated using ((select auth.uid()) = user_id);
create policy "checkins_insert_own" on public.checkins for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "checkins_delete_own" on public.checkins for delete to authenticated using ((select auth.uid()) = user_id);

create policy "reports_select_own" on public.life_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "reports_insert_own" on public.life_reports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reports_update_own" on public.life_reports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reports_delete_own" on public.life_reports for delete to authenticated using ((select auth.uid()) = user_id);

create policy "deletion_requests_insert_own" on public.account_deletion_requests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "deletion_requests_select_own" on public.account_deletion_requests for select to authenticated using ((select auth.uid()) = user_id);

create policy "future_letters_own" on public.future_letters for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "trusted_contacts_own" on public.trusted_contacts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "memorial_requests_contact_read" on public.memorial_requests for select to authenticated using (
  exists (select 1 from public.trusted_contacts tc where tc.id = trusted_contact_id and tc.user_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-media', 'entry-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "entry_media_storage_select_own" on storage.objects for select to authenticated
using (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "entry_media_storage_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "entry_media_storage_update_own" on storage.objects for update to authenticated
using (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "entry_media_storage_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.life_entries, public.entry_media, public.checkins, public.life_reports, public.future_letters, public.trusted_contacts to authenticated;
grant select, insert on public.account_deletion_requests to authenticated;
grant select on public.memorial_requests to authenticated;
