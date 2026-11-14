-- =====================================================================
--  PRIMO SOCCER KIDS — LINK DO PROFESSOR (link + PIN)
--  Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run
--
--  Como funciona:
--  • O professor abre o link (professor.html?t=...) e digita o PIN.
--  • Ele só vê os alunos dos horários que você liberou e só ENVIA pontos.
--  • O que ele envia fica PENDENTE. Só entra no campeonato quando você
--    aprovar no app (Início → Pontuações do professor).
--  • O PIN fica guardado embaralhado (bcrypt). 8 PINs errados = bloqueio
--    de 15 minutos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) Acesso do professor (1 por app)
create table if not exists public.primo_teacher_access (
  app_id          text primary key,
  token           text not null,
  pin_hash        text not null,
  teacher_name    text,
  enabled         boolean not null default true,
  roster          jsonb   not null default '{}'::jsonb,
  failed_attempts int     not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
alter table public.primo_teacher_access enable row level security;
drop policy if exists "teacher_access_admin" on public.primo_teacher_access;
create policy "teacher_access_admin" on public.primo_teacher_access
  for all to authenticated using (true) with check (true);

-- 2) Pontuações enviadas pelo professor (pendentes / aprovadas / recusadas)
create table if not exists public.primo_teacher_scores (
  id           bigint generated always as identity primary key,
  app_id       text  not null,
  month        text  not null,
  week         int   not null check (week between 0 and 4),
  schedule     text  not null,
  category     text,
  teacher_name text,
  scores       jsonb not null,
  status       text  not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create unique index if not exists primo_teacher_scores_one_pending
  on public.primo_teacher_scores(app_id, month, week, schedule) where status = 'pendente';
alter table public.primo_teacher_scores enable row level security;
drop policy if exists "teacher_scores_admin" on public.primo_teacher_scores;
create policy "teacher_scores_admin" on public.primo_teacher_scores
  for all to authenticated using (true) with check (true);

-- 3) Conferência do link + PIN (com bloqueio por tentativas)
create or replace function public.primo_teacher_auth(p_app text, p_token text, p_pin text)
returns public.primo_teacher_access
language plpgsql security definer set search_path = public, extensions as $$
declare a public.primo_teacher_access;
begin
  select * into a from public.primo_teacher_access where app_id = p_app;
  if a.app_id is null or not a.enabled or a.token is distinct from p_token then
    return null;
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return null;
  end if;
  if a.pin_hash = extensions.crypt(coalesce(p_pin,''), a.pin_hash) then
    if a.failed_attempts <> 0 or a.locked_until is not null then
      update public.primo_teacher_access set failed_attempts = 0, locked_until = null where app_id = p_app;
    end if;
    return a;
  end if;
  update public.primo_teacher_access
     set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= 8 then now() + interval '15 minutes' else locked_until end
   where app_id = p_app;
  return null;
end; $$;
revoke all on function public.primo_teacher_auth(text,text,text) from public, anon, authenticated;

-- 4) Professor: buscar a lista de alunos dos horários dele + o que já enviou
create or replace function public.primo_teacher_get(p_app text, p_token text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.primo_teacher_access; sent jsonb;
begin
  a := public.primo_teacher_auth(p_app, p_token, p_pin);
  if a.app_id is null then
    return jsonb_build_object('ok', false, 'error',
      case when exists(select 1 from public.primo_teacher_access x where x.app_id=p_app and x.locked_until > now())
           then 'bloqueado' else 'acesso' end);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'month',s.month,'week',s.week,'schedule',s.schedule,
           'status',s.status,'scores',s.scores,'updated_at',s.updated_at) order by s.updated_at desc), '[]'::jsonb)
    into sent
    from public.primo_teacher_scores s
   where s.app_id = p_app and s.month = a.roster->>'month' and s.updated_at > now() - interval '45 days';
  return jsonb_build_object('ok', true, 'name', a.teacher_name, 'roster', a.roster, 'sent', sent);
end; $$;

-- 5) Professor: enviar a pontuação de UM treino (fica pendente)
create or replace function public.primo_teacher_submit(p_app text, p_token text, p_pin text,
  p_month text, p_week int, p_schedule text, p_scores jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.primo_teacher_access; slot jsonb; clean jsonb := '{}'::jsonb; k text; v jsonb; n int := 0;
begin
  a := public.primo_teacher_auth(p_app, p_token, p_pin);
  if a.app_id is null then return jsonb_build_object('ok', false, 'error', 'acesso'); end if;
  if p_month is distinct from a.roster->>'month' then return jsonb_build_object('ok', false, 'error', 'mes'); end if;
  if p_week is null or p_week < 0 or p_week > 4 then return jsonb_build_object('ok', false, 'error', 'semana'); end if;
  select x into slot from jsonb_array_elements(coalesce(a.roster->'slots','[]'::jsonb)) x where x->>'schedule' = p_schedule limit 1;
  if slot is null then return jsonb_build_object('ok', false, 'error', 'horario'); end if;
  if jsonb_typeof(p_scores) is distinct from 'object' then return jsonb_build_object('ok', false, 'error', 'dados'); end if;
  for k, v in select key, value from jsonb_each(p_scores) loop
    -- só aceita alunos que estão nesse horário
    continue when not exists (select 1 from jsonb_array_elements(coalesce(slot->'students','[]'::jsonb)) st where st->>'id' = k);
    clean := clean || jsonb_build_object(k, jsonb_build_object(
      'pd',            least(greatest(coalesce(nullif(v->>'pd','')::numeric,0),0),1000),
      'pe',            least(greatest(coalesce(nullif(v->>'pe','')::numeric,0),0),1000),
      'uniforme',      least(greatest(coalesce(nullif(v->>'uniforme','')::numeric,0),0),20),
      'fruta',         least(greatest(coalesce(nullif(v->>'fruta','')::numeric,0),0),20),
      'comportamento', least(greatest(coalesce(nullif(v->>'comportamento','')::numeric,0),0),20)));
    n := n + 1;
  end loop;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'vazio'); end if;
  insert into public.primo_teacher_scores(app_id, month, week, schedule, category, teacher_name, scores)
  values (p_app, p_month, p_week, p_schedule, slot->>'category', a.teacher_name, clean)
  on conflict (app_id, month, week, schedule) where status = 'pendente'
  do update set scores = excluded.scores, updated_at = now(), teacher_name = excluded.teacher_name;
  return jsonb_build_object('ok', true, 'alunos', n);
end; $$;

grant execute on function public.primo_teacher_get(text,text,text) to anon, authenticated;
grant execute on function public.primo_teacher_submit(text,text,text,text,int,text,jsonb) to anon, authenticated;

-- 6) Administrador (você, logado no app): criar/trocar link e PIN
create or replace function public.primo_teacher_admin_set(p_app text, p_token text, p_pin text,
  p_name text, p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return jsonb_build_object('ok', false, 'error', 'somente administrador');
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'PIN deve ter de 4 a 6 números');
  end if;
  insert into public.primo_teacher_access(app_id, token, pin_hash, teacher_name, enabled)
  values (p_app, p_token, extensions.crypt(coalesce(p_pin,'0000'), extensions.gen_salt('bf')), p_name, coalesce(p_enabled,true))
  on conflict (app_id) do update set
    token        = coalesce(excluded.token, primo_teacher_access.token),
    pin_hash     = case when p_pin is null then primo_teacher_access.pin_hash else excluded.pin_hash end,
    teacher_name = coalesce(p_name, primo_teacher_access.teacher_name),
    enabled      = coalesce(p_enabled, primo_teacher_access.enabled),
    failed_attempts = 0, locked_until = null, updated_at = now();
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.primo_teacher_admin_set(text,text,text,text,boolean) from public, anon;
grant execute on function public.primo_teacher_admin_set(text,text,text,text,boolean) to authenticated;
