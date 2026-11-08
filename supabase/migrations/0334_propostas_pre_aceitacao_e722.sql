-- E722 — pré-aceitação de 72 horas (decisão do Daniel, validada pelo coordenador). Só colunas novas e opcionais em `propostas`.
-- Propostas antigas ficam sem prazo (pre_aceitacao_ate nulo): nada expira retroativamente.
--   pre_aceitacao_ate        fim da janela (72 h corridas, limitada pela data de entrada)
--   pre_aceitacao_reaberturas quantas vezes a janela foi reaberta (no máximo 2)
--   pre_aceitacao_lembrete_24h_em / _6h_em   quando cada lembrete saiu (uma vez só)
--   pre_aceitacao_expirou_em quando a janela venceu sem contrato (expira SEM punição)
--   pre_aceitacao_perdeu_em  quando outra pessoa concluiu o contrato nas mesmas datas antes (regra de corrida): a candidatura volta à fila do dono
-- A taxa congelada (taxa_congelada) NÃO muda na reabertura: a decisão do Daniel é que ela continua valendo.
alter table public.propostas add column if not exists pre_aceitacao_ate timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_reaberturas smallint not null default 0;
alter table public.propostas add column if not exists pre_aceitacao_lembrete_24h_em timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_lembrete_6h_em timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_expirou_em timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_perdeu_em timestamptz;
alter table public.propostas drop constraint if exists propostas_pre_aceitacao_reaberturas_valida;
alter table public.propostas add constraint propostas_pre_aceitacao_reaberturas_valida check (pre_aceitacao_reaberturas between 0 and 2);
create index if not exists propostas_pre_aceitacao_idx on public.propostas (pre_aceitacao_ate) where status = 'aceita' and pre_aceitacao_ate is not null;
