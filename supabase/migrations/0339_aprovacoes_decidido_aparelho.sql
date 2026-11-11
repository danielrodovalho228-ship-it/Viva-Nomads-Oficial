-- 0339 — Trilha de auditoria das aprovações: DE QUAL APARELHO veio a decisão (ordem 12a8086d, item 4).
--   decidido_aparelho  resumo de vocabulário fixo gravado pelo servidor junto de decidido_por/decidido_em
--                      (ex.: "Celular · iPhone · Safari", "App Viva Nomads · Android").
--   Sem dado pessoal: nunca o user-agent cru, nunca IP. Só o servidor (service_role) grava; a RLS
--   "aprovacoes: admin le" continua igual. O gatilho de imutabilidade segue valendo: a coluna só é
--   preenchida no mesmo update que tira a linha de 'pendente'.
-- Só acrescenta coluna opcional; idempotente. Desfazer: supabase/producao/rollback/0339_rollback.sql.
alter table public.aprovacoes add column if not exists decidido_aparelho text
  check (decidido_aparelho is null or char_length(decidido_aparelho) <= 60);

comment on column public.aprovacoes.decidido_aparelho is
  'Resumo do aparelho da decisão (tipo · sistema · navegador). Sem user-agent cru e sem IP.';
