create or replace function public.enforce_profile_target_lock()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.actual_death_date is distinct from new.actual_death_date then
    raise exception 'actual_death_date cannot be changed through the normal profile flow';
  end if;
  if old.birth_date is distinct from new.birth_date
     or old.target_age is distinct from new.target_age
     or old.target_date is distinct from new.target_date then
    raise exception 'Core life target can only be confirmed once and cannot be changed separately';
  end if;
  return new;
end;
$$;
