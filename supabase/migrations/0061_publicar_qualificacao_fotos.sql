-- ─────────────────────────────────────────────────────────────────────────────
-- 0061 — destrava a PUBLICAÇÃO de anúncios.
--
-- 1. qualification_checklists.internet_tier: o "Salvar qualificação" grava o
--    nível da internet, mas a coluna nunca existiu. Toda gravação falhava
--    ("Could not find the 'internet_tier' column") — 0 qualificações na base.
-- 2. property_photos e property_workspaces: RLS ligada desde a 0001 SEM
--    nenhuma política. O site não conseguia gravar nem ler fotos (inserção
--    recusada em silêncio), então nenhum anúncio chegava às 8 fotos exigidas
--    para publicar (0009) e o público não via as fotos.
--    Mesmo padrão de property_amenities/property_proximities (0018).
--    Foto nova só vale se for do bucket property-photos NA PASTA DO DONO.
-- 3. Rascunhos que já têm fotos só no draft_data passam a tê-las em
--    property_photos (o "faltam 8 fotos" com 8 enviadas).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 ──────────────────────────────────────────────────────────────────────────
alter table public.qualification_checklists
  add column if not exists internet_tier text;

alter table public.qualification_checklists
  drop constraint if exists qualification_checklists_internet_tier_check;
alter table public.qualification_checklists
  add constraint qualification_checklists_internet_tier_check
  check (internet_tier is null or internet_tier in ('basica', 'trabalho_remoto', 'home_office'));

-- 2 ──────────────────────────────────────────────────────────────────────────
drop policy if exists "fotos públicas" on public.property_photos;
create policy "fotos públicas" on public.property_photos for select using (
  exists (select 1 from public.properties p
           where p.id = property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);

drop policy if exists "admin lê fotos" on public.property_photos;
create policy "admin lê fotos" on public.property_photos for select using (public.is_admin());

drop policy if exists "dono apaga fotos" on public.property_photos;
create policy "dono apaga fotos" on public.property_photos for delete using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);

drop policy if exists "dono grava fotos" on public.property_photos;
create policy "dono grava fotos" on public.property_photos for insert with check (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  and position('/storage/v1/object/public/property-photos/' || auth.uid()::text || '/' in url) > 0
);

drop policy if exists "dono altera fotos" on public.property_photos;
create policy "dono altera fotos" on public.property_photos for update using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  and position('/storage/v1/object/public/property-photos/' || auth.uid()::text || '/' in url) > 0
);

drop policy if exists "espaços de trabalho públicos" on public.property_workspaces;
create policy "espaços de trabalho públicos" on public.property_workspaces for select using (
  exists (select 1 from public.properties p
           where p.id = property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);
drop policy if exists "dono gerencia espaços de trabalho" on public.property_workspaces;
create policy "dono gerencia espaços de trabalho" on public.property_workspaces for all using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);

-- 3 ──────────────────────────────────────────────────────────────────────────
-- Só rascunhos sem nenhuma foto gravada; só URLs da pasta do dono; até 24;
-- na ordem do editor (a 1ª é a capa). O trigger da 0009 recalcula photo_count.
insert into public.property_photos (property_id, url, sort_order)
select p.id, f.url, (f.ord - 1)::int
  from public.properties p
  cross join lateral (
    select e->>'url' as url, ord
      from jsonb_array_elements(
             case when jsonb_typeof(p.draft_data->'photos') = 'array'
                  then p.draft_data->'photos' else '[]'::jsonb end
           ) with ordinality as t(e, ord)
  ) f
 where p.status = 'draft'
   and f.url like 'https://%'
   and position('/storage/v1/object/public/property-photos/' || p.owner_id::text || '/' in f.url) > 0
   and f.ord <= 24
   and not exists (select 1 from public.property_photos pp where pp.property_id = p.id);

-- Conferência (rodar depois):
--   select column_name from information_schema.columns
--    where table_name = 'qualification_checklists' and column_name = 'internet_tier';
--   select policyname, cmd from pg_policies
--    where tablename in ('property_photos', 'property_workspaces') order by 1;
--   select title, photo_count from public.properties where status = 'draft';
