-- Desfaz a 0078 (Central de Agentes). Apaga o histórico de rondas, ordens e conversas.
drop function if exists public.ordens_pendentes(text);
drop function if exists public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text);
drop table if exists public.agentes_conversas;
drop table if exists public.agentes_ordens;
drop table if exists public.agentes_rondas;
drop table if exists public.agentes;
