-- Bucket PRIVADO para documentos do imóvel (ex.: autorização de sublocação,
-- matrícula). Diferente do `property-photos` (público, para as fotos do
-- anúncio), este NÃO é legível por qualquer um — só o dono (dono da pasta) e o
-- admin, via URL assinada. Corrige o achado do laudo: documento privado não
-- pode ficar em bucket público.

insert into storage.buckets (id, name, public)
values ('property-docs', 'property-docs', false)
on conflict (id) do nothing;

-- Convenção de caminho: `<owner_id>/<arquivo>` — as políticas usam a 1ª pasta
-- (owner_id) para restringir por dono.

-- Leitura: só o dono da pasta (ou admin). Sem política pública.
drop policy if exists "docs: dono lê" on storage.objects;
create policy "docs: dono lê"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'property-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Upload: só na própria pasta.
drop policy if exists "docs: dono envia" on storage.objects;
create policy "docs: dono envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Remoção: só na própria pasta (ou admin).
drop policy if exists "docs: dono remove" on storage.objects;
create policy "docs: dono remove"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
