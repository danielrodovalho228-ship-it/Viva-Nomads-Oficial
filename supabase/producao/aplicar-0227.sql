-- Viva Nomads — aplicar 0227 (preferências por categoria e diagnóstico do push — 44-B2). Idempotente. Rollback: supabase/producao/rollback/0227_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Categorias desligadas ────────────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists notif_categorias_desligadas text[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_notif_categorias_chk') then
    alter table public.profiles add constraint profiles_notif_categorias_chk
      check (notif_categorias_desligadas <@ array['mensagens', 'lembretes', 'outros']::text[]);
  end if;
end $$;
comment on column public.profiles.notif_categorias_desligadas is
  'Prompt 44: categorias de aviso desligadas pela pessoa (mensagens, lembretes, outros). Decisões e segurança não desligam.';

-- ── 2. Registro dos envios de push ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.push_envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  evento text check (evento is null or char_length(evento) <= 80),
  enviados integer not null default 0 check (enviados >= 0),
  falhas integer not null default 0 check (falhas >= 0),
  tokens_mortos integer not null default 0 check (tokens_mortos >= 0),
  criado_em timestamptz not null default now()
);
create index if not exists push_envios_criado_em on public.push_envios (criado_em desc);
comment on table public.push_envios is
  'Prompt 44: contagem de cada envio de push (diagnóstico do admin, 7 dias). Apagado depois de 30 dias.';
alter table public.push_envios enable row level security;
revoke all on public.push_envios from anon, authenticated;
grant all on public.push_envios to service_role;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000227', '0227_preferencias_push',
       array['-- conteúdo em supabase/migrations/0227_preferencias_push.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000227');
commit;
