-- Rollback da 0157: remove os dois índices (só desempenho; nenhum dado muda).
begin;
drop index if exists public.idx_pedidos_ajuda_publicacao_property_id;
drop index if exists public.idx_property_negociacao_limites_owner_id;
delete from supabase_migrations.schema_migrations where version = '20261018000157';
commit;
