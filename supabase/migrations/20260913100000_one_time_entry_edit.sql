-- Every existing record receives one edit from this release onward.
-- No public access and no private text revision archive are introduced.
alter table public.life_entries
  add column edit_count smallint not null default 0 check (edit_count between 0 and 1),
  add column edited_at timestamptz,
  add column last_edit_request_id uuid;

create function public.guard_entry_edit_once()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.edit_count := 0; new.edited_at := null; new.last_edit_request_id := null;
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.entry_date is distinct from old.entry_date or new.created_at is distinct from old.created_at
    or new.visibility is distinct from old.visibility then
    raise exception 'ENTRY_IDENTITY_IMMUTABLE';
  end if;
  if new.edit_count is distinct from old.edit_count or new.edited_at is distinct from old.edited_at then
    raise exception 'ENTRY_EDIT_COUNTER_IMMUTABLE';
  end if;
  if row(new.content,new.mood,new.category) is not distinct from row(old.content,old.mood,old.category) then
    new.last_edit_request_id := old.last_edit_request_id;
    return new;
  end if;
  if old.edit_count >= 1 then raise exception 'ENTRY_EDIT_ALREADY_USED'; end if;
  if btrim(new.content) = '' and not exists(select 1 from public.entry_media m where m.entry_id = old.id) then
    raise exception 'ENTRY_CONTENT_REQUIRED';
  end if;
  new.edit_count := 1;
  new.edited_at := now();
  return new;
end;
$$;
create trigger life_entries_guard_edit_once before insert or update on public.life_entries
for each row execute function public.guard_entry_edit_once();

-- Row lock serializes concurrent edits across devices. A retry of a committed
-- request returns the existing result, without allowing a different second edit.
create function public.edit_private_entry_once(p_entry_id uuid, p_content text,
  p_mood public.entry_mood, p_category public.entry_category, p_request_id uuid)
returns setof public.life_entries language plpgsql security invoker set search_path = '' as $$
declare current_entry public.life_entries;
begin
  if auth.uid() is null or p_request_id is null then raise exception 'ENTRY_AUTH_REQUIRED'; end if;
  if p_content is null or char_length(p_content) > 12000 or p_mood is null or p_category is null then
    raise exception 'ENTRY_INVALID_INPUT';
  end if;
  select * into current_entry from public.life_entries
    where id = p_entry_id and user_id = auth.uid() for update;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  if current_entry.last_edit_request_id = p_request_id and current_entry.edit_count = 1
    and row(current_entry.content,current_entry.mood,current_entry.category)
      is not distinct from row(btrim(p_content),p_mood,p_category) then
    return next current_entry; return;
  end if;
  if current_entry.edit_count >= 1 then raise exception 'ENTRY_EDIT_ALREADY_USED'; end if;
  return query update public.life_entries set content = btrim(p_content), mood = p_mood,
    category = p_category, last_edit_request_id = p_request_id
    where id = p_entry_id and user_id = auth.uid() returning *;
end;
$$;
revoke all on function public.edit_private_entry_once(uuid,text,public.entry_mood,public.entry_category,uuid) from public, anon;
grant execute on function public.edit_private_entry_once(uuid,text,public.entry_mood,public.entry_category,uuid) to authenticated;
