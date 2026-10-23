-- Viva Nomads — rollback da 0213 (Adendo 59.1: níveis, ruído, extras, medição por ponto, lista v2). Idempotente.
-- Apaga as declarações de nível, o ruído, os extras e o nível calculado; tira o ponto das medições; volta a lista do
-- padrão mínimo à versão 1 (10 itens). As confirmações da versão 2 continuam gravadas e valem na versão 1.
begin;
set local lock_timeout = '5s';
drop view if exists public.internet_medida_ponto_publica;
drop function if exists public.internet_medida_ponto_publica_lista();
alter table public.internet_medicoes drop constraint if exists internet_medicoes_ponto_check;
alter table public.internet_medicoes drop column if exists ponto;
drop table if exists public.imovel_nivel;
drop table if exists public.imovel_extras;
drop table if exists public.imovel_ruido;
drop table if exists public.nivel_itens;
alter table public.conforto_adequacao drop column if exists versao_lista;
create or replace function public.conforto_chaves()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['cama_colchao', 'roupa_cama_banho', 'agua_quente', 'cozinha_basica', 'ventilacao_quartos',
               'iluminacao', 'fechadura_entrada', 'entrega_limpa', 'internet_informada', 'mobilia_das_fotos']::text[];
$$;
create or replace function public.conforto_completo(p_property uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct d.chave) = cardinality(public.conforto_chaves())
    from public.conforto_declaracoes d
   where d.property_id = p_property and d.confirmado and d.chave = any (public.conforto_chaves());
$$;
drop function if exists public.conforto_versoes();
delete from supabase_migrations.schema_migrations where version = '20261023000213';
commit;
