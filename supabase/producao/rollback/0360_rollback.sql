-- Rollback da 0360: tira a marca da proposta descartada pelo dono (as designações ficam como estão, com a resposta gravada).
begin;
alter table public.vistoria_designacoes drop column if exists proposta_descartada_em;
delete from supabase_migrations.schema_migrations where version = '20261124000360';
commit;
