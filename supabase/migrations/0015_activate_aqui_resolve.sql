-- ════════════════════════════════════════════════════════════════════
-- Ativa a Aqui Resolve (serviços adicionais) — sai de "em_breve" para "ativo".
-- Idempotente: roda depois do 0014 (que cria/seeda as linhas) e pode ser
-- reaplicado sem efeito colateral. Não mexe no 0014 já versionado.
-- Os serviços continuam OPCIONAIS e em seção separada da garantia (regra no app).
-- ════════════════════════════════════════════════════════════════════

update public.servicos_adicionais
set status = 'ativo'
where id in ('assistencia_24h', 'plano_manutencao');
