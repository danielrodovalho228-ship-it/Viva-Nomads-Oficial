-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0056 (p1_integridade_limites). ⚠️ Reabre A3 (dono aprova o
-- próprio documento / publica sem aprovação / infla selos). As rotas de IA,
-- Places, CAF e empresas passam a responder "temporariamente indisponível"
-- (o código novo falha FECHADO sem consumir_limite).
-- Rode tudo de uma vez no SQL Editor (é uma transação).
-- ════════════════════════════════════════════════════════════════════════════
begin;

drop trigger if exists trg_qualificacao_protege_revisao on public.qualification_checklists;
drop function if exists public.qualificacao_protege_revisao();
drop trigger if exists trg_properties_protege_campos on public.properties;
drop function if exists public.properties_protege_campos();
drop function if exists public.consumir_limite(text, int, int);
drop table if exists public.limites_uso;
drop table if exists public.cobrancas_fechamento;

commit;
