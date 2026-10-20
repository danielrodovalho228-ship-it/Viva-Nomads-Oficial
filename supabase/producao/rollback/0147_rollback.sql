-- Rollback da 0147: tira a leitura pública de limpeza_estadia. O anúncio volta a abrir sem o pacote de limpeza (lê NULL).
begin;
revoke select (limpeza_estadia) on public.properties from anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261017000147';
commit;
