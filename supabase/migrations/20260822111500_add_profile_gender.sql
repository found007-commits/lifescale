alter table public.profiles
add column if not exists gender_identity text not null default 'private'
check (gender_identity in ('male', 'female', 'l', 'g', 'b', 't', 'q', 'private'));

comment on column public.profiles.gender_identity is 'User-selected profile option. Values are restricted to male, female, L, G, B, T, Q, or private.';
