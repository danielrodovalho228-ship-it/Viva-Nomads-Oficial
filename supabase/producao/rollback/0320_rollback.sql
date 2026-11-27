-- Rollback da 0320 (E662). Colunas aditivas e nulas: desfazer = desregistrar e (se quiser) removê-las.
-- Só rode o drop se NENHUM dono tiver escrito a instrução de saída (senão perde o texto).
begin;
alter table public.contratos drop column if exists instrucao_saida;
alter table public.imovel_instrucoes_chegada drop column if exists instrucao_saida;
delete from supabase_migrations.schema_migrations where version = '20261107000320';
commit;
