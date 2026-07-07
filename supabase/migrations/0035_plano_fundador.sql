-- Piloto "Fundador": marcador na conta do proprietário para o desconto futuro.
-- Nenhuma cobrança de assinatura é ativada no piloto — este campo só registra
-- quem entrou como fundador (para aplicar os 20% vitalícios quando a cobrança
-- começar). A comissão de fechamento do fundador segue a trilha do Profissional
-- (8%), como qualquer proprietário nesse plano.

alter table public.profiles
  add column if not exists fundador boolean not null default false,
  add column if not exists fundador_em timestamptz;

comment on column public.profiles.fundador is
  'Piloto Fundador: conta entrou como um dos 20 primeiros proprietários (desconto vitalício de 20% quando a cobrança de assinatura começar).';
comment on column public.profiles.fundador_em is
  'Quando a conta foi marcada como fundadora.';
