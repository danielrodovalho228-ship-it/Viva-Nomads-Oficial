-- Viva Nomads — 0179: fotos do pet e carteira de vacina (ordem a9c8aaff). Idempotente.
-- Rollback: supabase/producao/rollback/0179_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';
alter table public.pets_inquilino add column if not exists fotos text[] not null default '{}';
alter table public.pets_inquilino add column if not exists carteira_vacina text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pets_inquilino_fotos_max3') then
    alter table public.pets_inquilino add constraint pets_inquilino_fotos_max3 check (cardinality(fotos) <= 3);
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pets-fotos', 'pets-fotos', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pets-fotos: dono le') then
    create policy "pets-fotos: dono le" on storage.objects for select to authenticated
      using (bucket_id = 'pets-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pets-fotos: dono envia') then
    create policy "pets-fotos: dono envia" on storage.objects for insert to authenticated
      with check (bucket_id = 'pets-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pets-fotos: dono apaga') then
    create policy "pets-fotos: dono apaga" on storage.objects for delete to authenticated
      using (bucket_id = 'pets-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000179', '0179_pets_fotos',
       array['-- conteúdo em supabase/migrations/0179_pets_fotos.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000179');
commit;
