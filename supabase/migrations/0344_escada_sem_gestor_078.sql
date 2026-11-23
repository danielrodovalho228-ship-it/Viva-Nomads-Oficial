-- 0344 — prompt 078 (decisão do Daniel, 16/11/2026): lançar SEM o Plano Gestor público de 4%. Na tabela faixas_comissao
-- a escada passa a terminar em "16 ou mais = 6%": 16–19 vira 16+ (sem teto) e sai a faixa de 20+ a 4% (entrou na 0293).
-- Condição especial de carteira grande ou administradora é caso a caso, pela taxa fixada pelo admin (comissao_fixada_admin).
-- Não toca em propostas, contratos nem em taxa congelada. Depende da 0293. Idempotente.
-- Desfazer: supabase/producao/rollback/0344_rollback.sql.
-- 1) Sai a faixa de 20+ (Plano Gestor, 4%). A antiga "31+" (pré-0293) também não pode sobrar.
delete from public.faixas_comissao where min_imoveis in (20, 31);
-- 2) A escada inteira, com a última faixa sem teto: 16 ou mais = 6%.
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values
  (1, 2, 0.12), (3, 5, 0.10), (6, 15, 0.08), (16, null, 0.06)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
-- 3) A faixa de cada dono com a tabela nova (0292). Quem estava a 4% pela faixa de 20+ passa a 6%; pela regra da queda
--    (0172), a taxa anterior ainda vale por 30 dias para esse dono.
select public.atualizar_faixas_dos_donos();
