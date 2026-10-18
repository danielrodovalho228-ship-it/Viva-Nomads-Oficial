-- Viva Nomads — aplicar 0157 (índices nas chaves estrangeiras sem índice). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0157_rollback.sql.
begin;
set local lock_timeout = '5s';

create index if not exists idx_pedidos_ajuda_publicacao_property_id on public.pedidos_ajuda_publicacao (property_id);
create index if not exists idx_property_negociacao_limites_owner_id on public.property_negociacao_limites (owner_id);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000157', '0157_indices_chaves_estrangeiras',
       array['-- conteúdo em supabase/migrations/0157_indices_chaves_estrangeiras.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000157');
commit;
