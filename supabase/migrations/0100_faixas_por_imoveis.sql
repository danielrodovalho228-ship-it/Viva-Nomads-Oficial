-- 0100 — FAIXAS DE COMISSÃO POR Nº DE IMÓVEIS ATIVOS (ordens aa916ba9 e f768b951, Daniel 10/10; valem sobre a regra única da 0099).
--   • faixas_comissao volta com 5 degraus: 1–2 = 12% · 3–5 = 10% · 6–15 = 8% · 16–30 = 6% · 31+ = 6% (Plano Gestor).
--     O 31+ NÃO tem 4% automático: fica em 6% até o admin fixar condição negociada (comissao_fixada_admin, com motivo e validade).
--   • config taxa_renovacao deixa de ser usada: a renovação conta como novo contrato, com a mesma taxa da faixa do dono.
-- Sem dado pessoal. Idempotente: pode rodar mais de uma vez com o mesmo resultado. Depende da 0096 e da 0099.

insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values
  (1, 2, 0.12), (3, 5, 0.10), (6, 15, 0.08), (16, 30, 0.06), (31, null, 0.06)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
