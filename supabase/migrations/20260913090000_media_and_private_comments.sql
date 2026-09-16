-- Additive: existing entries remain private. Public publishing is NOT enabled here.
alter table public.entry_media drop constraint if exists entry_media_media_type_check;
alter table public.entry_media add constraint entry_media_media_type_check
  check (media_type like 'image/%' or media_type in ('video/mp4', 'video/quicktime'));
update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','video/mp4','video/quicktime']
where id = 'entry-media';

-- Prevent attaching a user's object to somebody else's entry.
drop policy if exists "media_insert_own" on public.entry_media;
create policy "media_insert_own" on public.entry_media for insert to authenticated
with check (user_id = (select auth.uid())
  and split_part(storage_path, '/', 1) = (select auth.uid())::text
  and split_part(storage_path, '/', 2) = entry_id::text
  and exists (select 1 from public.life_entries e where e.id = entry_id and e.user_id = (select auth.uid())));

create table public.entry_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.life_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (id, entry_id),
  foreign key (parent_id, entry_id) references public.entry_comments(id, entry_id) on delete cascade
);
create index entry_comments_entry_date_idx on public.entry_comments(entry_id, created_at, id);
alter table public.entry_comments enable row level security;
revoke all on public.entry_comments from anon, authenticated;
grant select, insert, delete on public.entry_comments to authenticated;
create policy comments_select_owner on public.entry_comments for select to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.life_entries e where e.id = entry_id and e.user_id = (select auth.uid())
));
create policy comments_insert_owner on public.entry_comments for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.life_entries e where e.id = entry_id and e.user_id = (select auth.uid())
));
create policy comments_delete_owner on public.entry_comments for delete to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.life_entries e where e.id = entry_id and e.user_id = (select auth.uid())
));
