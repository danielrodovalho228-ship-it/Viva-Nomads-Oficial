-- 0280 — E399-C, pacote 2 (liberado pelo Daniel em 01/11): o resultado da comparação do selo "Preço justo".
-- Na tabela fechada da 0279 (só o servidor lê): o total de 30 noites do anúncio no Airbnb (simulação das próximas 30
-- noites disponíveis, com desconto de estadia longa, limpeza e taxa do hóspede), quando foi consultado (reconsulta
-- semanal; mais de 14 dias suspende o selo) e o último aviso ao dono (para não repetir o mesmo valor). Idempotente.
-- Rollback: supabase/producao/rollback/0280_rollback.sql.

alter table public.preco_justo_airbnb add column if not exists total_30_noites numeric(12, 2) check (total_30_noites is null or total_30_noites > 0);
alter table public.preco_justo_airbnb add column if not exists consultado_em timestamptz;
alter table public.preco_justo_airbnb add column if not exists aviso_enviado_em timestamptz;
alter table public.preco_justo_airbnb add column if not exists aviso_valor numeric(12, 2);

create index if not exists preco_justo_airbnb_consulta_idx on public.preco_justo_airbnb (consultado_em nulls first) where conferencia = 'confere';
