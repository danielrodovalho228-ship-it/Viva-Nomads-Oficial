-- Viva Nomads — aplicar 0115 (código por e-mail para assinar contrato, ordens 810ffe98 / 0a097187).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0115_rollback.sql.
begin;
set local lock_timeout = '5s';
create table if not exists public.contrato_assinatura_codigos (
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  expira_em timestamptz not null,
  falhas int not null default 0,
  usado_em timestamptz,
  enviado_em timestamptz not null default now(),
  primary key (contrato_id, user_id)
);

alter table public.contrato_assinatura_codigos enable row level security;
revoke all on public.contrato_assinatura_codigos from anon, authenticated;

comment on table public.contrato_assinatura_codigos is 'Hash do código de e-mail para assinar contrato (uso único, expira, limite de falhas). Só service_role.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000115', '0115_contrato_assinatura_codigos',
       array['-- conteúdo em supabase/migrations/0115_contrato_assinatura_codigos.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000115');
commit;
