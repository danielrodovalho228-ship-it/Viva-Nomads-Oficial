-- Rollback da 0299 (E440): tira o vínculo do contrato com o orçamento de origem (a tela volta à leitura pelo pedido).
begin;
alter table public.contratos drop column if exists proposta_id;
delete from supabase_migrations.schema_migrations where version = '20261105000299';
commit;
