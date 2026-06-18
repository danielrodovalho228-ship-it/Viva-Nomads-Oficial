-- ─────────────────────────────────────────────────────────────
-- 0008 — detalhes do checklist de qualificação
-- ─────────────────────────────────────────────────────────────

-- A documentação do imóvel (matrícula ou contrato de gestão) é um item
-- obrigatório da Camada 1 (eligibilityChecks), mas até aqui era coletada no
-- formulário e nunca persistida. Adiciona a coluna para registrá-la junto do
-- restante do checklist.
alter table qualification_checklists
  add column has_document boolean not null default false;
