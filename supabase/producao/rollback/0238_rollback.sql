-- Viva Nomads — rollback da 0238: tira as colunas de curadoria/distância de property_proximities e a tabela de reportes.
-- Os nomes, categorias e notas antigas continuam. Idempotente.
begin;
set local lock_timeout = '5s';
drop table if exists public.proximidades_reportes;
alter table public.properties drop constraint if exists properties_cep_proximidades_chk, drop column if exists cep_proximidades;
alter table public.property_proximities
  drop constraint if exists property_proximities_origem_chk,
  drop constraint if exists property_proximities_tipo_chk,
  drop constraint if exists property_proximities_distancia_chk,
  drop constraint if exists property_proximities_tempo_chk,
  drop constraint if exists property_proximities_endereco_chk,
  drop column if exists tipo,
  drop column if exists origem,
  drop column if exists distancia_m,
  drop column if exists tempo_min,
  drop column if exists tempo_modo,
  drop column if exists endereco,
  drop column if exists lat,
  drop column if exists lng,
  drop column if exists oculto;
delete from supabase_migrations.schema_migrations where version = '20261024000238';
commit;
