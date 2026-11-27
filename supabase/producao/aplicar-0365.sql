-- Viva Nomads — aplicar 0365 (E1208: a linha curada do perfil público liga-se ao credenciamento do mesmo número).
-- Idempotente: só liga onde credenciamento_id está vazio. Aplicada pela Action quando o PR é mesclado.
-- Rollback: supabase/producao/rollback/0365_rollback.sql.
begin;
set local lock_timeout = '5s';

update public.avaliadores_perfil_publico p
   set credenciamento_id = c.id
  from public.avaliadores_credenciamento c
 where p.credenciamento_id is null
   and c.numero_credenciado = p.numero
   and not exists (select 1 from public.avaliadores_perfil_publico o where o.credenciamento_id = c.id);

insert into supabase_migrations.schema_migrations (version, name)
select '20261126000365', '0365_avaliador_perfil_curado_ligado_e1208'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261126000365');
commit;
