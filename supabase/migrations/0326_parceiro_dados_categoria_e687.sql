-- 0326 — E687: empresa e veículo da categoria Mudança chegam ao parceiro aprovado.
-- Hoje ficam só em parceiro_solicitacoes.dados_categoria; a ativação passa a copiá-los para parceiros.dados_categoria
-- e quem já foi ativado é preenchido a partir do pedido de origem. Só coluna nova (default '{}'); nada é apagado.
-- Rollback: supabase/producao/rollback/0326_rollback.sql
alter table public.parceiros
  add column if not exists dados_categoria jsonb not null default '{}'::jsonb;

update public.parceiros p
   set dados_categoria = s.dados_categoria
  from public.parceiro_solicitacoes s
 where s.id = p.solicitacao_id
   and p.dados_categoria = '{}'::jsonb
   and s.dados_categoria is not null
   and s.dados_categoria <> '{}'::jsonb;
