-- 0157 — Lentidão (ordem 0f66a754, item 3): índices nas 2 chaves estrangeiras sem índice apontadas pelo
-- advisor de performance do Supabase (unindexed_foreign_keys). Só cria índices; não muda dado nem política.
-- Fora desta migração, de propósito: a política "mensagens das partes" (auth_rls_initplan) — a 0146 mostrou que
-- embrulhar auth.uid() ali gera recursão de política em messages.
-- Idempotente. Rollback: supabase/producao/rollback/0157_rollback.sql.
create index if not exists idx_pedidos_ajuda_publicacao_property_id on public.pedidos_ajuda_publicacao (property_id);
create index if not exists idx_property_negociacao_limites_owner_id on public.property_negociacao_limites (owner_id);
