-- PRIMO SOCCER KIDS 2026 - V32 PRO
-- Estrutura recomendada para o Supabase.
-- O app usa a anon key no frontend. Para proteção forte, use RLS e evite políticas públicas de escrita.

create table if not exists public.primo_app_state (
  app_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.primo_app_state enable row level security;

drop policy if exists "primo_public_read" on public.primo_app_state;
drop policy if exists "primo_public_insert" on public.primo_app_state;
drop policy if exists "primo_public_update" on public.primo_app_state;
drop policy if exists "primo_public_delete" on public.primo_app_state;

-- Leitura pública necessária para o link dos pais e para carregar o app.
create policy "primo_public_read"
on public.primo_app_state
for select
to anon
using (app_id = 'primo_soccer_kids_league_2026');

-- ATENÇÃO:
-- Não crie política pública de insert/update se quiser banco realmente somente leitura para visitantes.
-- Para escrita segura, crie autenticação real do Supabase ou Edge Function com segredo no servidor.
-- Enquanto o app estiver 100% frontend, qualquer escrita com anon key depende de política pública.
