-- ─────────────────────────────────────────────────────────────
-- Enriquecimento da página do imóvel (padrão de média estadia).
-- Campos/tabelas OPCIONAIS — a UI esconde a seção quando o dado não existe.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ─────────────────────────────────────────────────────────────

-- Novos campos no imóvel (todos opcionais / com default).
alter table properties add column if not exists parking_spots int default 0;
alter table properties add column if not exists condo_fee numeric(10, 2) default 0;
alter table properties add column if not exists available_from date;
alter table properties add column if not exists furnished boolean default true;
alter table properties add column if not exists pets_allowed boolean;
alter table properties add column if not exists smoking_allowed boolean default false;
alter table properties add column if not exists max_guests int;
alter table properties add column if not exists checkin_after text;  -- ex.: "14:00"
alter table properties add column if not exists checkout_before text; -- ex.: "11:00"

-- Perfil do proprietário (bloco de confiança).
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists response_rate int check (response_rate between 0 and 100);
alter table profiles add column if not exists is_verified boolean not null default false;

-- Comodidades por categoria (substitui a lista plana na exibição).
create table if not exists property_amenities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  category text not null,   -- trabalho | cozinha | conforto | edificio | seguranca
  label text not null,
  sort_order int default 0
);
create index if not exists property_amenities_property_idx on property_amenities (property_id);

-- Proximidades úteis (hospitais, universidades, centros empresariais, mercado, transporte).
create table if not exists property_proximities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  category text not null,   -- saude | educacao | trabalho | mercado | transporte
  name text not null,
  note text,                -- ex.: "10 min a pé"
  sort_order int default 0
);
create index if not exists property_proximities_property_idx on property_proximities (property_id);

-- Avaliações reais (substitui os exemplos fixos na tela).
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  author_name text not null,
  rating numeric(2, 1) not null check (rating between 0 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_property_idx on reviews (property_id, created_at desc);

-- ── RLS ──
alter table property_amenities enable row level security;
alter table property_proximities enable row level security;
alter table reviews enable row level security;

-- Leitura pública quando o imóvel está ativo (mesma regra de "imóveis ativos são públicos");
-- o dono também enxerga os dos seus imóveis (rascunho/pausado).
drop policy if exists "amenidades públicas" on property_amenities;
create policy "amenidades públicas" on property_amenities for select using (
  exists (select 1 from properties p where p.id = property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);
drop policy if exists "dono gerencia amenidades" on property_amenities;
create policy "dono gerencia amenidades" on property_amenities for all using (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
);

drop policy if exists "proximidades públicas" on property_proximities;
create policy "proximidades públicas" on property_proximities for select using (
  exists (select 1 from properties p where p.id = property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);
drop policy if exists "dono gerencia proximidades" on property_proximities;
create policy "dono gerencia proximidades" on property_proximities for all using (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
);

drop policy if exists "avaliações públicas" on reviews;
create policy "avaliações públicas" on reviews for select using (
  exists (select 1 from properties p where p.id = property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);
drop policy if exists "dono gerencia avaliações" on reviews;
create policy "dono gerencia avaliações" on reviews for all using (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
);
