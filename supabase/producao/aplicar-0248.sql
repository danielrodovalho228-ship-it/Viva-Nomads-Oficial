-- Viva Nomads — aplicar 0248 (vínculo profissional por e-mail corporativo, parte 1). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0248_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.vinculo_profissional (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dominio text not null check (dominio = lower(dominio) and dominio ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0 check (tentativas >= 0),
  confirmado_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table public.vinculo_profissional enable row level security;
revoke all on public.vinculo_profissional from anon, authenticated;

comment on table public.vinculo_profissional is
  'Vínculo profissional por e-mail corporativo: domínio + hash do código. Sem política de RLS: só o servidor acessa.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261025000248', '0248_vinculo_profissional', array['-- conteúdo em supabase/migrations/0248_vinculo_profissional.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261025000248');
commit;
