-- 0108 — ASSINATURAS DO CONTRATO (ordem de412a9c, F33). O contrato só pode aparecer "Em vigência" depois das DUAS
-- assinaturas e do 1º pagamento confirmado pelas duas partes; estas colunas guardam QUANDO cada parte assinou.
-- Preenchidas só pelo servidor (service role) quando a assinatura digital existir; ninguém grava pelo navegador
-- (o usuário não tem UPDATE em contratos desde a 0057). Contratos já existentes ficam com NULL = "Aguardando assinatura"
-- (inclui o [TESTE QA], que passa a mostrar o estado certo sem editar dado). Idempotente, sem dados pessoais.

alter table public.contratos add column if not exists assinado_proprietario_em timestamptz;
alter table public.contratos add column if not exists assinado_inquilino_em timestamptz;

comment on column public.contratos.assinado_proprietario_em is 'Quando o proprietário assinou o contrato (NULL = ainda não assinou). Só o servidor grava.';
comment on column public.contratos.assinado_inquilino_em is 'Quando o inquilino assinou o contrato (NULL = ainda não assinou). Só o servidor grava.';
