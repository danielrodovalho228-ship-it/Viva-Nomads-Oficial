-- Rollback da 0326 (E687). Remove só a coluna parceiros.dados_categoria (o pedido de origem guarda os mesmos dados).
begin;
alter table public.parceiros drop column if exists dados_categoria;
delete from supabase_migrations.schema_migrations where version = '20261107000326';
commit;
