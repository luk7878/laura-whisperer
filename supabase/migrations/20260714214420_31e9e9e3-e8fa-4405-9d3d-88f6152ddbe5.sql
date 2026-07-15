create table if not exists public.agent_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  confirm_before_write boolean not null default true,
  remember_goal_history boolean not null default true,
  include_values_context boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.agent_settings to authenticated;
grant all on public.agent_settings to service_role;

alter table public.agent_settings enable row level security;

create policy "Users manage own agent settings"
  on public.agent_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  access_source text not null default 'preview'
    check (access_source in ('preview', 'subscription', 'admin', 'trial')),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create index if not exists feature_entitlements_lookup_idx
  on public.feature_entitlements (user_id, feature_key, active);

grant select on public.feature_entitlements to authenticated;
grant all on public.feature_entitlements to service_role;

alter table public.feature_entitlements enable row level security;

create policy "Users view own feature entitlements"
  on public.feature_entitlements for select
  using (auth.uid() = user_id);

insert into public.agent_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.feature_entitlements (user_id, feature_key, access_source, active)
select id, 'growth_agent', 'preview', true from auth.users
on conflict (user_id, feature_key) do nothing;

create or replace function public.create_growth_agent_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agent_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.feature_entitlements (user_id, feature_key, access_source, active)
  values (new.id, 'growth_agent', 'preview', true)
  on conflict (user_id, feature_key) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_growth_agent_defaults on auth.users;
create trigger on_auth_user_growth_agent_defaults
  after insert on auth.users
  for each row execute function public.create_growth_agent_defaults();