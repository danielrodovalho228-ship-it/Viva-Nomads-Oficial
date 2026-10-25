-- Viva Nomads — 0169: telefone opcional do visitante no chamado (ordem 8e720f03, F24). Idempotente.
-- Rollback: supabase/producao/rollback/0169_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

alter table public.chamados add column if not exists visitante_telefone text;
alter table public.chamados drop constraint if exists chamados_visitante_telefone_formato;
alter table public.chamados add constraint chamados_visitante_telefone_formato
  check (visitante_telefone is null or visitante_telefone ~ '^[0-9]{10,13}$');

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000169', '0169_chamado_visitante_telefone',
       array['-- conteúdo em supabase/migrations/0169_chamado_visitante_telefone.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000169');
commit;
