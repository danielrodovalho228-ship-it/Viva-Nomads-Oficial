-- ─────────────────────────────────────────────────────────────
-- Storage: bucket de fotos de imóveis (público para leitura)
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

-- Leitura pública das fotos
create policy "fotos públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'property-photos');

-- Upload: usuário autenticado só envia para a própria pasta (prefixo = seu uid)
create policy "proprietário envia suas fotos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Remoção: só das próprias fotos
create policy "proprietário remove suas fotos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
