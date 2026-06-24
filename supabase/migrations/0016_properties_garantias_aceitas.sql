-- ════════════════════════════════════════════════════════════════════
-- Modalidades de garantia que o proprietário ACEITA por imóvel.
-- Só preferência de aceite — NÃO muda o caminho do dinheiro (a caução sempre
-- vai para conta vinculada, nunca para a plataforma). Idempotente.
-- ════════════════════════════════════════════════════════════════════

alter table public.properties
  add column if not exists garantias_aceitas text[] not null default '{}';
