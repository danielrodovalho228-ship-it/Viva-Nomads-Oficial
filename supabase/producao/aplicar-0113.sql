-- Viva Nomads — aplicar 0113 (2FA: códigos de recuperação e refazer, ordens 58901f0f / 10484c4c).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0113_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.mfa_codigos_recuperacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, codigo_hash)
);
create index if not exists mfa_codigos_recuperacao_user_idx on public.mfa_codigos_recuperacao (user_id);

create table if not exists public.mfa_controle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  falhas int not null default 0,
  bloqueado_ate timestamptz,
  refazer_hash text,
  refazer_expira timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.mfa_codigos_recuperacao enable row level security;
alter table public.mfa_controle enable row level security;
revoke all on public.mfa_codigos_recuperacao from anon, authenticated;
revoke all on public.mfa_controle from anon, authenticated;

comment on table public.mfa_codigos_recuperacao is 'Hash de códigos de recuperação do 2FA (uso único). Só service_role.';
comment on table public.mfa_controle is 'Tentativas de recuperação do 2FA e código de e-mail para refazer. Só service_role.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261013000113', '0113_mfa_codigos_recuperacao',
       array['-- conteúdo em supabase/migrations/0113_mfa_codigos_recuperacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261013000113');
commit;
