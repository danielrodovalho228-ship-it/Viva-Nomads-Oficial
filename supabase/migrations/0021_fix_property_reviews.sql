-- ─────────────────────────────────────────────────────────────
-- HOTFIX: a 0018 tentou criar uma tabela "reviews" com property_id, mas já
-- existe uma "reviews" (0004, avaliações de CONTRATO, sem property_id). O
-- "create table if not exists" pulou, e a policy quebrou (42703) — e o
-- "drop policy if exists ... on reviews" pode ter removido a policy original.
--
-- Este hotfix: (1) restaura as policies de 0004 em "reviews"; (2) cria a tabela
-- correta "property_reviews" para avaliações de IMÓVEL. Idempotente.
-- ─────────────────────────────────────────────────────────────

-- (1) Restaura as policies originais da tabela reviews (avaliações de contrato).
drop policy if exists "avaliações públicas" on reviews;
create policy "avaliações públicas" on reviews for select using (true);
drop policy if exists "autor cria avaliação" on reviews;
create policy "autor cria avaliação" on reviews for insert with check (author_id = auth.uid());

-- (2) Tabela de avaliações de IMÓVEL (nome próprio, sem colidir com reviews).
create table if not exists property_reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  author_name text not null,
  rating numeric(2, 1) not null check (rating between 0 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists property_reviews_idx on property_reviews (property_id, created_at desc);

alter table property_reviews enable row level security;

drop policy if exists "avaliações de imóvel públicas" on property_reviews;
create policy "avaliações de imóvel públicas" on property_reviews for select using (
  exists (select 1 from properties p where p.id = property_reviews.property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);
drop policy if exists "dono gerencia avaliações de imóvel" on property_reviews;
create policy "dono gerencia avaliações de imóvel" on property_reviews for all using (
  exists (select 1 from properties p where p.id = property_reviews.property_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from properties p where p.id = property_reviews.property_id and p.owner_id = auth.uid())
);
