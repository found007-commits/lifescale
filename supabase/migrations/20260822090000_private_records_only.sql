-- LifeScale privacy hardening: user records are private-only.
-- Existing public rows are made private before the constraint is installed.

update public.life_entries
set visibility = 'private'
where visibility <> 'private';

update public.life_reports
set visibility = 'private'
where visibility <> 'private';

drop policy if exists "entries_select_own_or_public" on public.life_entries;
drop policy if exists "entries_select_own" on public.life_entries;
drop policy if exists "entries_insert_own" on public.life_entries;
drop policy if exists "entries_update_own" on public.life_entries;

create policy "entries_select_own"
on public.life_entries for select to authenticated
using ((select auth.uid()) = user_id);

create policy "entries_insert_own"
on public.life_entries for insert to authenticated
with check ((select auth.uid()) = user_id and visibility = 'private');

create policy "entries_update_own"
on public.life_entries for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and visibility = 'private');

alter table public.life_entries
drop constraint if exists life_entries_private_only;

alter table public.life_entries
add constraint life_entries_private_only check (visibility = 'private');

alter table public.life_reports
drop constraint if exists life_reports_private_only;

alter table public.life_reports
add constraint life_reports_private_only check (visibility = 'private');

drop index if exists public.life_entries_public_idx;
