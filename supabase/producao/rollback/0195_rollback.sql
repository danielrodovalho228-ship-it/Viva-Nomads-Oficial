-- Rollback da 0195 (Prompt 37): tira destinos, cache de tempos, contagem de buscas, o gatilho do imóvel e as colunas
-- local_trabalho (perfil) e destino (pedido de moradia). APAGA os destinos cadastrados pelo admin e o local de trabalho
-- salvo pelas pessoas — confira antes de rodar.
begin;
set local lock_timeout = '5s';
drop trigger if exists trg_tempos_limpa_ao_mover_imovel on public.properties;
drop function if exists public.tempos_limpa_ao_mover_imovel();
drop function if exists public.contar_busca_destino(uuid, date);
drop table if exists public.buscas_destino;
drop table if exists public.tempos_deslocamento;
drop table if exists public.destinos;
revoke update (local_trabalho) on public.profiles from authenticated;
alter table public.profiles drop constraint if exists profiles_local_trabalho_chk;
alter table public.profiles drop column if exists local_trabalho;
alter table public.pedidos_moradia drop constraint if exists pedidos_moradia_destino_chk;
alter table public.pedidos_moradia drop column if exists destino;
delete from supabase_migrations.schema_migrations where version = '20261020000195';
commit;
