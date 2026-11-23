-- DD Instagram comment auto-reply: rules and settings edited from the DD admin panel.
-- The Cloudflare worker (workers/ig-autoreply/worker.js) reads these with the service role key (which bypasses RLS).
-- The admin panel (/admin, "Instagram auto-reply") reads and writes them as a signed-in Supabase user, and the
-- policies below only let accounts listed in public.dd_admins through.
-- Run once in Supabase: SQL editor -> paste -> Run. Safe to re-run.
--
-- BEFORE RUNNING: every admin email below must already have a DD account that its real owner created.
-- DD signup does not verify email ownership, so an admin row only counts for an account that existed when the
-- row was added (see dd_is_admin). An account created later with that email gets nothing until the row is
-- re-dated:  update public.dd_admins set added_at = now() where email = '<email>';

create table if not exists public.ig_autoreply_rules (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,                       -- e.g. "Anthropic IPO"
  enabled                 boolean not null default true,
  priority                integer not null default 100,         -- lower runs first when two rules could match
  keywords                text[] not null default '{}',         -- matched as whole words, any case
  media_ids               text[] not null default '{}',         -- empty = any post or reel
  link_url                text,                                 -- inserted wherever a template says {link}
  dm_templates            text[] not null default '{}',         -- one picked at random; {username}, {link}
  public_reply_templates  text[] not null default '{}',
  public_reply_chance     numeric not null default 0 check (public_reply_chance between 0 and 1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.ig_autoreply_settings (
  id                      integer primary key default 1 check (id = 1),  -- single row
  paused                  boolean not null default false,
  dry_run                 boolean not null default true,        -- start in test mode
  max_dms_per_hour        integer not null default 700 check (max_dms_per_hour between 1 and 700),
  public_replies_enabled  boolean not null default false,
  updated_at              timestamptz not null default now()
);
insert into public.ig_autoreply_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.ig_autoreply_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists ig_autoreply_rules_touch on public.ig_autoreply_rules;
create trigger ig_autoreply_rules_touch before update on public.ig_autoreply_rules
  for each row execute function public.ig_autoreply_touch();
drop trigger if exists ig_autoreply_settings_touch on public.ig_autoreply_settings;
create trigger ig_autoreply_settings_touch before update on public.ig_autoreply_settings
  for each row execute function public.ig_autoreply_touch();

alter table public.ig_autoreply_rules    enable row level security;
alter table public.ig_autoreply_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Admins: keyed by email. Only admins can read the list; nobody can change it through the API
-- (edit it in the SQL editor).
-- ---------------------------------------------------------------------------
create table if not exists public.dd_admins (
  email     text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  note      text,
  added_at  timestamptz not null default now()
);
alter table public.dd_admins enable row level security;

-- True when the signed-in user's email (from auth.users, not from the token) is in dd_admins, and that
-- account already existed when it was made an admin. Security definer so policies can call it without
-- giving users read access to auth.users or recursing through dd_admins' own policy.
create or replace function public.dd_is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from public.dd_admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
      and u.created_at <= a.added_at
  );
$$;
revoke all on function public.dd_is_admin() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.dd_is_admin() from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.dd_is_admin() to authenticated; end if;
end $$;

-- Table privileges: nothing for anon; authenticated gets only what the policies then narrow to admins.
revoke all on public.dd_admins, public.ig_autoreply_rules, public.ig_autoreply_settings from anon, authenticated;
grant select on public.dd_admins to authenticated;
grant select, insert, update, delete on public.ig_autoreply_rules to authenticated;
grant select, update on public.ig_autoreply_settings to authenticated;  -- single row: no insert or delete

drop policy if exists dd_admins_read on public.dd_admins;
create policy dd_admins_read on public.dd_admins
  for select to authenticated using (public.dd_is_admin());

drop policy if exists ig_autoreply_rules_admins on public.ig_autoreply_rules;
create policy ig_autoreply_rules_admins on public.ig_autoreply_rules
  for all to authenticated using (public.dd_is_admin()) with check (public.dd_is_admin());

drop policy if exists ig_autoreply_settings_admins_read on public.ig_autoreply_settings;
create policy ig_autoreply_settings_admins_read on public.ig_autoreply_settings
  for select to authenticated using (public.dd_is_admin());
drop policy if exists ig_autoreply_settings_admins_update on public.ig_autoreply_settings;
create policy ig_autoreply_settings_admins_update on public.ig_autoreply_settings
  for update to authenticated using (public.dd_is_admin()) with check (public.dd_is_admin());

-- Seed admins. Re-running keeps the original added_at (on conflict do nothing).
insert into public.dd_admins (email, note) values
  ('dailydividendwork@gmail.com', 'DD work account')
  -- TODO before running: add the other two admins here, e.g.
  -- , ('someone@example.com', 'Name')
on conflict (email) do nothing;

-- Starter rule (the current Anthropic IPO reel)
insert into public.ig_autoreply_rules (name, keywords, link_url, dm_templates)
select
  'Anthropic IPO',
  array['anthropic', 'claude'],
  'https://www.dailydividend.info/rabbit-holes/anthropic-ipo-decoded',
  array[
    'Thank you for your comment. Here''s the full breakdown of the Anthropic (Claude) IPO: {link} Hope you find it useful and let us know if you have any thoughts :)',
    'Hey {username}, thanks for commenting! Here''s our full breakdown of the Anthropic (Claude) IPO: {link} Let us know what you think :)',
    'Thanks for the comment! As promised, here''s the Anthropic (Claude) IPO breakdown: {link} Hope it''s useful :)'
  ]
where not exists (select 1 from public.ig_autoreply_rules where name = 'Anthropic IPO');
