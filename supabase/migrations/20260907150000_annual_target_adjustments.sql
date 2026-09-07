-- First setting is free; each real target change starts a new calendar-year wait.
alter table public.profiles add column target_change_count integer not null default 0
  check (target_change_count between 0 and 3);

create or replace function public.enforce_profile_target_lock()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.created_at := now();
    new.target_change_count := 0;
    new.target_locked_until := now() + interval '1 year';
    if new.actual_death_date is not null then
      raise exception 'actual_death_date cannot be set through the normal profile flow';
    end if;
    return new;
  end if;
  if old.birth_date is distinct from new.birth_date then
    raise exception 'Birth date cannot be changed after confirmation';
  end if;
  if old.actual_death_date is distinct from new.actual_death_date then
    raise exception 'actual_death_date cannot be changed through the normal profile flow';
  end if;
  if old.created_at is distinct from new.created_at
     or old.target_change_count is distinct from new.target_change_count
     or old.target_locked_until is distinct from new.target_locked_until then
    raise exception 'Target adjustment counters and dates are managed by the server';
  end if;
  if old.target_age is distinct from new.target_age or old.target_date is distinct from new.target_date then
    if old.target_change_count >= 3 then
      raise exception 'TARGET_CHANGE_LIMIT: All 3 adjustments have been used';
    end if;
    if now() < old.target_locked_until then
      raise exception 'TARGET_CHANGE_LOCKED: Next adjustment available at %', old.target_locked_until;
    end if;
    if new.target_date <= current_date then
      raise exception 'TARGET_DATE_PAST: Choose a future life target';
    end if;
    if new.target_age is not null and new.target_date is distinct from
       (new.birth_date + pg_catalog.make_interval(years => new.target_age))::date then
      raise exception 'Target age and date must agree';
    end if;
    new.target_change_count := old.target_change_count + 1;
    new.target_locked_until := now() + interval '1 year';
  end if;
  return new;
end;
$$;

drop trigger profiles_enforce_target_lock on public.profiles;
create trigger profiles_enforce_target_lock before insert or update on public.profiles
for each row execute function public.enforce_profile_target_lock();
comment on column public.profiles.target_change_count is 'Server-managed lifetime target adjustments, excluding initial setup; maximum 3.';
