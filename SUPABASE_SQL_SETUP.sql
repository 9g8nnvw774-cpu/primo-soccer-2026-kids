create table if not exists public.primo_app_state (
  app_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.primo_app_state enable row level security;
drop policy if exists "Allow public read primo app state" on public.primo_app_state;
create policy "Allow public read primo app state" on public.primo_app_state for select to anon using (true);
drop policy if exists "Allow public insert primo app state" on public.primo_app_state;
create policy "Allow public insert primo app state" on public.primo_app_state for insert to anon with check (true);
drop policy if exists "Allow public update primo app state" on public.primo_app_state;
create policy "Allow public update primo app state" on public.primo_app_state for update to anon using (true) with check (true);
insert into public.primo_app_state (app_id, data)
values ('primo_soccer_2026_kids', '{}'::jsonb)
on conflict (app_id) do nothing;
