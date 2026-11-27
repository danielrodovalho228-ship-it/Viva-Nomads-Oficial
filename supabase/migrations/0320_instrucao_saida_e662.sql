-- E662 (parte Pista B) — instrução ÚNICA de saída (check-out) por contrato: o dono escreve uma vez, morador e dono leem o MESMO texto.
-- Duas colunas novas, nulas e aditivas:
--   • imovel_instrucoes_chegada.instrucao_saida — o texto do dono. A tabela é PRIVADA (RLS "só o dono"; o morador recebe pelo servidor, liberada
--     7 dias antes da entrada). Por isso NÃO vai em `properties`, que o visitante lê na página pública do anúncio.
--   • contratos.instrucao_saida — a cópia da 1ª assinatura, para o texto não mudar no meio da estadia (leitura: contrato primeiro, imóvel de reserva).
-- Sem grant novo: as duas são lidas e gravadas só pelo servidor / pelo dono (RLS e grants das tabelas já valem).
alter table public.imovel_instrucoes_chegada
  add column if not exists instrucao_saida text check (instrucao_saida is null or char_length(instrucao_saida) <= 1500);

alter table public.contratos
  add column if not exists instrucao_saida text check (instrucao_saida is null or char_length(instrucao_saida) <= 1500);

comment on column public.imovel_instrucoes_chegada.instrucao_saida is
  'E662: instrução única de saída (check-out) escrita pelo dono. Privada; o morador a recebe pelo servidor, junto das instruções da estadia.';
comment on column public.contratos.instrucao_saida is
  'E662: cópia da instrução de saída na 1ª assinatura (congelada). Null = contrato anterior à coluna ou sem texto: vale a do imóvel.';
