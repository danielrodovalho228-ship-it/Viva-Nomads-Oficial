-- Rollback da 0302 (E513): só tira o registro. As fotos trocadas são massa de teste e ficam (voltar às 8 fotos repetidas
-- recriaria o defeito); se for preciso, a QA reenvia as fotos.
begin;
delete from supabase_migrations.schema_migrations where version = '20261105000302';
commit;
