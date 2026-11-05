-- Rollback da 0303 (E603): só tira o registro. Os quartos copiados são o dado que o dono já tinha digitado; voltar a 0 recriaria o defeito.
begin;
delete from supabase_migrations.schema_migrations where version = '20261105000303';
commit;
