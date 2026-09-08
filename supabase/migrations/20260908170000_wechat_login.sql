-- WeChat credentials are server-only. Existing account IDs and private data stay unchanged.
create table public.wechat_identities (
  app_id text not null,
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (app_id, subject_hash),
  unique (app_id, user_id)
);
alter table public.wechat_identities enable row level security;
revoke all on public.wechat_identities from public, anon, authenticated, service_role;
grant select, insert, delete on public.wechat_identities to service_role;

create table public.wechat_auth_limits (
  bucket text primary key,
  count integer not null,
  expires_at timestamptz not null
);
create index wechat_auth_limits_expiry on public.wechat_auth_limits(expires_at);
alter table public.wechat_auth_limits enable row level security;
revoke all on public.wechat_auth_limits from public, anon, authenticated, service_role;

-- Shared across serverless instances. Stores hashed buckets, never IP addresses or codes.
create function public.wechat_auth_allow(p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_count integer;
begin
  if p_limit < 1 or p_limit > 120 or p_seconds < 1 or p_seconds > 600 then return false; end if;
  delete from public.wechat_auth_limits where expires_at < now();
  insert into public.wechat_auth_limits as limits(bucket, count, expires_at)
  values(p_bucket, 1, now() + make_interval(secs => p_seconds))
  on conflict(bucket) do update set count = limits.count + 1
  returning count into current_count;
  return current_count <= p_limit;
end;
$$;
revoke all on function public.wechat_auth_allow(text, integer, integer) from public, anon, authenticated;
grant execute on function public.wechat_auth_allow(text, integer, integer) to service_role;

-- Recover a server-created, not-yet-linked account after an interrupted first login.
-- The marker is app_metadata, which end users cannot set, not user_metadata.
create function public.wechat_reserved_user(p_subject text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users
  where email = p_subject || '@wechat.lifescale.invalid'
    and raw_app_meta_data ->> 'lifescale_wechat_subject' = p_subject
  limit 1;
$$;
revoke all on function public.wechat_reserved_user(text) from public, anon, authenticated;
grant execute on function public.wechat_reserved_user(text) to service_role;

comment on table public.wechat_identities is 'Server-only immutable WeChat-to-account mapping. No raw OpenID/session_key or user-content copies.';
