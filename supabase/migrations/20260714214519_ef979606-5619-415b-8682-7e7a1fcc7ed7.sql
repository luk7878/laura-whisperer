create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  hypothesis text not null,
  action text not null,
  observable_behavior text not null,
  success_criterion text not null,
  start_date date not null default current_date,
  review_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_experiments_review_after_start check (review_date >= start_date)
);

grant select, insert, update, delete on public.growth_experiments to authenticated;
grant all on public.growth_experiments to service_role;

alter table public.growth_experiments enable row level security;

create policy "Users can view own growth experiments"
  on public.growth_experiments for select
  using (auth.uid() = user_id);
create policy "Users can create own growth experiments"
  on public.growth_experiments for insert
  with check (auth.uid() = user_id);
create policy "Users can update own growth experiments"
  on public.growth_experiments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own growth experiments"
  on public.growth_experiments for delete
  using (auth.uid() = user_id);

create index if not exists growth_experiments_user_status_idx
  on public.growth_experiments (user_id, status, review_date);
create index if not exists growth_experiments_session_idx
  on public.growth_experiments (session_id);