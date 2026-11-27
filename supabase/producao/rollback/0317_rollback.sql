-- Rollback da 0317 (E661). As colunas são aditivas e nulas: desfazer = desregistrar e (se quiser) removê-las.
-- Só rode o drop se NENHUM dono tiver preenchido a estrutura do condomínio (senão perde o texto).
begin;
alter table public.imovel_instrucoes_chegada
  drop column if exists condominio_wifi_rede,
  drop column if exists condominio_wifi_senha,
  drop column if exists condominio_recepcao,
  drop column if exists condominio_fechadura;
delete from supabase_migrations.schema_migrations where version = '20261107000317';
commit;
