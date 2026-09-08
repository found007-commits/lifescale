-- Initial setup is free. Three changes during its first calendar year,
-- then a full year between changes, with seven lifetime changes in total.
-- No account counters, target values or timestamps are reset/backfilled.
alter table public.profiles drop constraint profiles_target_change_count_check;
alter table public.profiles add constraint profiles_target_change_count_check
  check (target_change_count between 0 and 7);

create or replace function public.enforce_profile_target_lock()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  first_anniversary timestamptz;
begin
  if TG_OP = 'INSERT' then
    new.created_at := now();
    new.target_change_count := 0;
    new.target_locked_until := (now() at time zone 'UTC' + interval '1 year') at time zone 'UTC';
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
    if old.target_change_count >= 7 then
      raise exception 'TARGET_CHANGE_LIMIT: All 7 adjustments have been used';
    end if;
    first_anniversary := (old.created_at at time zone 'UTC' + interval '1 year') at time zone 'UTC';
    if now() < first_anniversary then
      if old.target_change_count >= 3 then
        raise exception 'TARGET_CHANGE_LOCKED: Next adjustment available at %', first_anniversary;
      end if;
    elsif now() < greatest(first_anniversary, old.target_locked_until) then
      raise exception 'TARGET_CHANGE_LOCKED: Next adjustment available at %', greatest(first_anniversary, old.target_locked_until);
    end if;
    if new.target_date <= current_date then
      raise exception 'TARGET_DATE_PAST: Choose a future life target';
    end if;
    if new.target_age is not null and new.target_date is distinct from
       (new.birth_date + pg_catalog.make_interval(years => new.target_age))::date then
      raise exception 'Target age and date must agree';
    end if;
    new.target_change_count := old.target_change_count + 1;
    new.target_locked_until := case when now() < first_anniversary then first_anniversary
      else (now() at time zone 'UTC' + interval '1 year') at time zone 'UTC' end;
  end if;
  return new;
end;
$$;

comment on column public.profiles.target_change_count is 'Server-managed lifetime target changes excluding setup: 3 in the first year, then annually, maximum 7 total.';
