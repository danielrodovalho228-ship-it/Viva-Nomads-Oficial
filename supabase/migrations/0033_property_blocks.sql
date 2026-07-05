-- Datas bloqueadas pelo proprietário (indisponibilidade). O calendário do
-- anúncio pinta esses dias como indisponíveis e a validação de reserva os
-- rejeita. Leitura pública (o anúncio é público); só o dono gerencia.

create table if not exists property_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  inicio date not null,
  fim date not null,
  created_at timestamptz not null default now(),
  constraint property_blocks_datas check (fim >= inicio)
);

create index if not exists property_blocks_prop_idx on property_blocks (property_id);

alter table property_blocks enable row level security;

-- Leitura pública: o calendário do anúncio (visível a qualquer visitante)
-- precisa saber quais dias estão fechados. Não expõe nada sensível — só datas.
drop policy if exists "blocks: leitura pública" on property_blocks;
create policy "blocks: leitura pública" on property_blocks
  for select using (true);

-- Só o dono do imóvel cria/edita/remove os bloqueios.
drop policy if exists "blocks: dono gerencia" on property_blocks;
create policy "blocks: dono gerencia" on property_blocks
  for all
  using (
    exists (
      select 1 from properties p
      where p.id = property_blocks.property_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from properties p
      where p.id = property_blocks.property_id and p.owner_id = auth.uid()
    )
  );
