-- 0179: fotos do pet (até 3) e carteira de vacina (1) — ordem a9c8aaff, parte 2 da 022afabb (item 1).
-- Bucket PRIVADO pets-fotos: só a própria pessoa lê/grava na pasta do seu uid; o servidor
-- confere o tipo real e regrava como WebP (sem EXIF) antes de subir. Só cria coisas novas.
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
