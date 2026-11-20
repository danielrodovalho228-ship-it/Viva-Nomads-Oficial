-- 0335 — E690: ativação automática do avaliador credenciado (regra validada pelo coordenador, 08/11/2026).
-- Só colunas novas e opcionais em avaliadores_credenciamento; nada é gravado por esta migração.
--   decidido_pelo_sistema  a decisão (em teste / ativo) veio da regra automática, não de um admin
--   criterios_decisao      os critérios do momento da decisão (json)
-- A chave NEXT_PUBLIC_AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA nasce desligada. Desfazer: supabase/producao/rollback/0335_rollback.sql.
alter table public.avaliadores_credenciamento add column if not exists decidido_pelo_sistema boolean not null default false;
alter table public.avaliadores_credenciamento add column if not exists criterios_decisao jsonb;
