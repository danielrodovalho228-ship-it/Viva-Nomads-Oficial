-- Rollback da 0196 (nunca roda sozinho). Apaga as colunas novas e o que elas guardavam:
-- cômodo das fotos, data de confirmação do calendário, quem cancelou, interruptor e registros da sombra.
begin;
drop function if exists public.ranking_sinais(uuid[]);
drop function if exists public.limpar_ranking_sombra();
drop table if exists public.ranking_sombra;
drop table if exists public.plataforma_chaves;
drop trigger if exists property_blocks_confirma_calendario on public.property_blocks;
drop function if exists public.property_blocks_confirma_calendario();
drop trigger if exists properties_disponibilidade_agora on public.properties;
drop function if exists public.properties_disponibilidade_agora();
alter table public.contratos drop constraint if exists contratos_cancelado_por_check;
alter table public.contratos drop column if exists cancelado_por;
alter table public.properties drop column if exists disponibilidade_confirmada_em;
alter table public.property_photos drop constraint if exists property_photos_comodo_check;
alter table public.property_photos drop column if exists comodo;
delete from supabase_migrations.schema_migrations where version = '20261021000196';
commit;
