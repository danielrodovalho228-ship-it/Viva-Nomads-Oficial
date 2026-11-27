-- E648 (aprovado pelo Daniel em 06/11/2026) — redesenho do avaliador (anti-subordinação). Atrás de VISTORIA_ATIVA (desligada).
-- O dono ESCOLHE o avaliador entre os sugeridos; o avaliador propõe o PRÓPRIO valor e o PRÓPRIO prazo; o dono aceita; o laudo é
-- ASSINADO pelo avaliador (a Viva guarda o hash). Só colunas novas e uma ampliação de check: nada de pagamento.
alter table public.vistoria_pedidos
  add column if not exists escolhido_em timestamptz,
  add column if not exists valor_proposto numeric(10, 2) check (valor_proposto is null or valor_proposto > 0),
  add column if not exists prazo_proposto_dias integer check (prazo_proposto_dias is null or (prazo_proposto_dias between 1 and 30)),
  add column if not exists proposta_em timestamptz,
  add column if not exists proposta_aceita_em timestamptz;

alter table public.vistoria_laudos
  add column if not exists assinado_por uuid references auth.users (id),
  add column if not exists assinado_em timestamptz,
  add column if not exists assinatura_hash text,
  add column if not exists assinatura_termo text;

-- Critério público de qualidade que fundamenta a revisão/descredenciamento, e o direito de resposta do avaliador.
alter table public.avaliadores_credenciamento
  add column if not exists criterio_descredenciamento text,
  add column if not exists resposta_ate timestamptz,
  add column if not exists resposta_avaliador text;

-- A fila do admin ganha "revisao_criterio" (critério público atingido: revisão humana, sem mudar o status sozinho).
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio'));
