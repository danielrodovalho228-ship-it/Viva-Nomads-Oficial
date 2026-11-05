-- 0293 — E564 (decisão do Daniel, 04/11/2026): o Plano Gestor deixa de ser assinatura (R$ 500/mês com 20 imóveis,
-- R$ 25 por extra, taxa zero) e vira a faixa de 4% para carteiras de 20+ imóveis ativos de verdade (E565). Na tabela
-- faixas_comissao: 16–30 vira 16–19 (6%), entra 20+ = 4% e sai a faixa "31+ negociável". Conta de administradora é
-- Gestor pelo servidor (taxaDoDonoAgora). Depende da 0292. Idempotente. Desfazer: supabase/producao/rollback/0293_rollback.sql.
-- 1) A antiga faixa "31+ negociável" deixa de existir.
delete from public.faixas_comissao where min_imoveis = 31;
-- 2) 16–19 = 6% (antes 16–30).
update public.faixas_comissao set max_imoveis = 19 where min_imoveis = 16;
-- 3) 20+ = Plano Gestor, 4%, sem teto.
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values (20, null, 0.04)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
-- 4) A faixa de cada dono com a tabela nova (0292). Quem sobe de faixa vale na hora; quem cai ganha a janela de 30 dias.
select public.atualizar_faixas_dos_donos();
