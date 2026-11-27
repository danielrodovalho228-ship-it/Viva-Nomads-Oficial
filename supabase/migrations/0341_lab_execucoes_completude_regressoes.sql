-- Frente 0 (correção consolidada de 11/11/2026): o laboratório grava, em cada rodada, se executou TUDO o que o commit lista
-- e quais specs que já foram verdes voltaram a falhar. Antes, as rodadas de 10/11 e 11/11 gravaram ~610 executados e
-- ~3.900 pulados sem que nada na linha dissesse que a rodada estava incompleta.
--   listados        = testes de `playwright test --list` no commit da rodada;
--   executados      = testes que rodaram até o fim (passou, falhou, instável ou falha conhecida);
--   nao_executados  = listados que não rodaram (teto global, fatia perdida, teste que nunca começou). Pulo declarado não conta;
--   regressoes      = [{spec, ultimoVerde, falhou}] dos specs com algum registro verde e vermelhos na rodada.
-- Linhas antigas ficam com null (não se sabe a listagem delas). Só leitura do admin, como o resto da tabela (0106).
alter table public.lab_execucoes add column if not exists listados integer;
alter table public.lab_execucoes add column if not exists executados integer;
alter table public.lab_execucoes add column if not exists nao_executados integer;
alter table public.lab_execucoes add column if not exists regressoes jsonb not null default '[]'::jsonb;
