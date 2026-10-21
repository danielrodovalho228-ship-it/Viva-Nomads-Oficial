-- Rollback da 0198 (nunca roda sozinho). Apaga as instruções de chegada, os ocupantes, as notas privadas, os aditivos
-- (com assinaturas, códigos e taxa registrada) e os pedidos de encerramento. Os contratos e os blocos não mudam: um
-- aditivo já assinado continua aplicado nos blocos.
begin;
drop function if exists public.aplicar_aditivo(uuid, uuid[], jsonb, integer, integer, numeric);
drop table if exists public.contrato_eventos;
drop table if exists public.contrato_encerramento_pedidos;
drop table if exists public.contrato_aditivo_codigos;
drop table if exists public.contrato_aditivo_assinaturas;
drop table if exists public.contrato_aditivo_taxa;
drop table if exists public.contrato_aditivos;
drop table if exists public.contrato_notas;
drop trigger if exists contrato_ocupantes_teto on public.contrato_ocupantes;
drop table if exists public.contrato_ocupantes;
drop function if exists public.contrato_ocupantes_teto();
drop table if exists public.imovel_instrucoes_chegada;
drop function if exists public.eh_parte_do_contrato(uuid);
delete from supabase_migrations.schema_migrations where version = '20261021000198';
commit;
