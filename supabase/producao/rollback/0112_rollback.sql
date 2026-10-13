-- Rollback da 0112: correção de dado, sem estrutura. Só remove o registro (o status antigo era um erro).
begin;
delete from supabase_migrations.schema_migrations where version = '20261013000112';
commit;
