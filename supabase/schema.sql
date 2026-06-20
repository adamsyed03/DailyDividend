create table if not exists public.daily_dividend_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.daily_dividend_state (id, data)
values (
  'default',
  jsonb_build_object(
    'users', jsonb_build_object(),
    'votes', jsonb_build_object(),
    'settings', jsonb_build_object('featuredCompany', 'netflix'),
    'companies', jsonb_build_object()
  )
)
on conflict (id) do nothing;

alter table public.daily_dividend_state enable row level security;

drop policy if exists "Server state access only" on public.daily_dividend_state;
create policy "Server state access only"
on public.daily_dividend_state
for all
using (false)
with check (false);
