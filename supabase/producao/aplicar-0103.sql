-- Viva Nomads — aplicar 0103 (aceite do anúncio feito com IA).
-- PRECISA APROVAÇÃO DO DANIEL — não aplicado. Aplicada pela Action quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0103_rollback.sql (perde os aceites gravados).
begin;
set local lock_timeout = '5s';
create table if not exists public.anuncio_aceites_ia (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  versao_termo text not null check (char_length(versao_termo) between 1 and 40),
  campos_gerados_ia text[] not null default '{}' check (cardinality(campos_gerados_ia) <= 10),
  campos_editados text[] not null default '{}' check (cardinality(campos_editados) <= 10),
  aceito_em timestamptz not null default now()
);
create index if not exists anuncio_aceites_ia_imovel on public.anuncio_aceites_ia (property_id, aceito_em desc);

alter table public.anuncio_aceites_ia enable row level security;
revoke all on public.anuncio_aceites_ia from public, anon, authenticated;
grant select, insert (property_id, versao_termo, campos_gerados_ia, campos_editados) on public.anuncio_aceites_ia to authenticated;
grant all on public.anuncio_aceites_ia to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='anuncio_aceites_ia' and policyname='aceites_ia: dono le') then
    create policy "aceites_ia: dono le" on public.anuncio_aceites_ia for select to authenticated
      using (owner_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='anuncio_aceites_ia' and policyname='aceites_ia: dono cria') then
    create policy "aceites_ia: dono cria" on public.anuncio_aceites_ia for insert to authenticated
      with check (owner_id = auth.uid()
                  and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261011000103', '0103_aceites_ia',
       array['-- conteúdo em supabase/migrations/0103_aceites_ia.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261011000103');
commit;
