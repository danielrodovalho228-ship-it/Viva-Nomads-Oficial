-- Pedido de Moradia — amplia os MOTIVOS aceitos (novo conjunto com descrições).
-- Troca o CHECK da coluna `motivo` para permitir as 9 novas chaves, mantendo as
-- 5 antigas (compat com pedidos já criados). Nada destrutivo.

alter table pedidos_moradia drop constraint if exists pedidos_moradia_motivo_check;

alter table pedidos_moradia
  add constraint pedidos_moradia_motivo_check
  check (motivo in (
    -- novos motivos
    'trabalho_remoto',
    'tratamento_medico',
    'relocacao_corporativa',
    'intercambio_pos',
    'reforma_transicao',
    'mudanca_familiar',
    'aposentadoria_lifestyle',
    'viagem_longa',
    'outro',
    -- chaves antigas (mantidas para não invalidar linhas existentes)
    'trabalho_saude',
    'trabalho_corporativo',
    'transicao',
    'estudo'
  ));
