-- SEGURANÇA RECOMENDADA - NÃO APLIQUE SEM ADAPTAR LOGIN/AUTENTICAÇÃO
-- O app atual usa Publishable/Anon Key no navegador. Se você bloquear UPDATE/INSERT para anon,
-- o app deixa de salvar até ter login Supabase ou uma API/backend segura.

alter table public.primo_app_state enable row level security;

drop policy if exists "Allow public read primo app state" on public.primo_app_state;
drop policy if exists "Allow public insert primo app state" on public.primo_app_state;
drop policy if exists "Allow public update primo app state" on public.primo_app_state;

-- Pais/visitantes podem ler o ranking.
create policy "Pais podem ler" on public.primo_app_state
for select to anon using (true);

-- Apenas usuários autenticados podem gravar.
-- Para usar isso, o app precisa ter tela de login Supabase.
create policy "Admin autenticado pode inserir" on public.primo_app_state
for insert to authenticated with check (true);

create policy "Admin autenticado pode atualizar" on public.primo_app_state
for update to authenticated using (true) with check (true);
