-- Onda 1 — parecer da Dra. Beatriz (estrutura; texto jurídico depois).
--
-- 1) Garantia "título de capitalização" APOSENTADA: não apagamos dados
--    históricos (properties.garantias_aceitas é text[] livre); o código apenas
--    deixa de OFERECER 'titulo'. Nada a alterar em coluna aqui — só documentado.
-- 2) Capacidade máxima do imóvel: reutiliza properties.max_guests (já existe da
--    0018). Sem coluna nova.
-- 3) modelos_contrato ganha `tipo_imovel` (opcional) para variações por tipo.
-- 4) Nova tabela `locacoes` — o "registro da locação": nº de ocupantes, caução
--    (50% do total), garantia, faixa e modelo de contrato selecionado.

-- ── 3) modelos_contrato: tipo de imóvel opcional ──
alter table modelos_contrato
  add column if not exists tipo_imovel text;

comment on column modelos_contrato.tipo_imovel is
  'Opcional: casa variações do modelo por tipo de imóvel; null = genérico da faixa.';

-- ── 4) Registro da locação (alimenta a cláusula de ocupação e a caução) ──
create table if not exists locacoes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  faixa faixa_prazo not null,
  modelo_contrato_id uuid references modelos_contrato(id),
  periodo_dias int not null,
  valor_total numeric(12,2) not null,           -- aluguel × meses (base da caução)
  caucao_valor numeric(12,2) not null,          -- 50% do valor_total (Onda 1)
  garantia text not null,                        -- caucao_avista | caucao_parcelada | seguro_fianca
  qtd_ocupantes int not null check (qtd_ocupantes >= 1),
  capacidade_snapshot int,                       -- max_guests do imóvel no fechamento
  ocupacao_verificada int,                       -- futuro: concierge confere a ocupação real
  created_at timestamptz not null default now()
);

create index if not exists locacoes_property_idx on locacoes (property_id);
create index if not exists locacoes_tenant_idx on locacoes (tenant_id);

alter table locacoes enable row level security;

-- Dono do imóvel e inquilino leem a própria locação.
drop policy if exists "locacao visível às partes" on locacoes;
create policy "locacao visível às partes" on locacoes
  for select using (
    tenant_id = auth.uid()
    or exists (
      select 1 from properties p
      where p.id = locacoes.property_id and p.owner_id = auth.uid()
    )
  );

-- O inquilino cria o registro da própria locação no fechamento.
drop policy if exists "inquilino cria locação" on locacoes;
create policy "inquilino cria locação" on locacoes
  for insert with check (tenant_id = auth.uid());
