-- Rollback da 0338 (E687, massa do parceiro de Mudança): remove só as linhas de ids fixos a0329… (o pedido recusado
-- anterior da conta fica intocado).
begin;
delete from public.parceiro_servicos where id = 'a0329000-0000-4000-8000-000000000012';
delete from public.parceiros where id = 'a0329000-0000-4000-8000-000000000011';
delete from public.parceiro_solicitacoes where id = 'a0329000-0000-4000-8000-000000000010';
delete from supabase_migrations.schema_migrations where version = '20261111000338';
commit;
