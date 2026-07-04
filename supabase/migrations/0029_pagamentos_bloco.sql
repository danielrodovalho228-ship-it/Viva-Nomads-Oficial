-- Registro DECLARATÓRIO de pagamento por bloco (Dashboard Fase 4).
--
-- REGRA DE OURO: a plataforma NÃO movimenta dinheiro. Aqui só se DOCUMENTA que
-- um aluguel foi recebido (o pagamento é feito direto ao proprietário, fora da
-- plataforma). O proprietário marca "recebido" (data + forma); o inquilino
-- confirma; tudo fica carimbado no histórico do contrato (futuro dossiê).
-- NENHUMA integração de pagamento.

create table if not exists pagamentos_bloco (
  id uuid primary key default gen_random_uuid(),
  bloco_id uuid not null references contrato_blocos(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  tipo text not null default 'aluguel' check (tipo in ('aluguel','caucao')),
  valor numeric(12,2) not null check (valor >= 0),
  forma text not null default 'pix' check (forma in ('pix','boleto','transferencia','dinheiro','outro')),
  data_pagamento date not null,
  marcado_por uuid not null references auth.users(id) on delete cascade, -- proprietário
  confirmado_pelo_inquilino boolean not null default false,
  confirmado_em timestamptz,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists pagamentos_bloco_bloco_idx on pagamentos_bloco (bloco_id);
create index if not exists pagamentos_bloco_contrato_idx on pagamentos_bloco (contrato_id);

alter table pagamentos_bloco enable row level security;

-- As duas partes do contrato (dono do imóvel e inquilino) leem o histórico.
drop policy if exists "pagamento visível às partes" on pagamentos_bloco;
create policy "pagamento visível às partes" on pagamentos_bloco
  for select using (
    exists (
      select 1 from contratos c
      where c.id = pagamentos_bloco.contrato_id
        and (
          c.tenant_id = auth.uid()
          or exists (
            select 1 from properties p
            where p.id = c.property_id and p.owner_id = auth.uid()
          )
        )
    )
  );

-- Só o PROPRIETÁRIO do imóvel registra o recebimento (marcado_por = ele).
drop policy if exists "proprietário registra recebimento" on pagamentos_bloco;
create policy "proprietário registra recebimento" on pagamentos_bloco
  for insert with check (
    marcado_por = auth.uid()
    and exists (
      select 1 from contratos c
      join properties p on p.id = c.property_id
      where c.id = pagamentos_bloco.contrato_id and p.owner_id = auth.uid()
    )
  );

-- O INQUILINO confirma o recebimento do seu contrato (atualiza a confirmação).
drop policy if exists "inquilino confirma pagamento" on pagamentos_bloco;
create policy "inquilino confirma pagamento" on pagamentos_bloco
  for update using (
    exists (
      select 1 from contratos c
      where c.id = pagamentos_bloco.contrato_id and c.tenant_id = auth.uid()
    )
  );

comment on table pagamentos_bloco is
  'Registro DECLARATÓRIO de pagamento (dono marca recebido, inquilino confirma). A plataforma documenta — NUNCA movimenta valores.';
