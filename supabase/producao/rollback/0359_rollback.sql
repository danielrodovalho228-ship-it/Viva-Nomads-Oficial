-- Rollback da 0359: tira a marca da proposta vencida sem aceite (as designações ficam como estão, com a resposta gravada).
begin;
alter table public.vistoria_designacoes drop column if exists proposta_expirada_em;
delete from supabase_migrations.schema_migrations where version = '20261124000359';
commit;
