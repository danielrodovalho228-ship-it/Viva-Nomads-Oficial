-- ══════════════════════════════════════════════════════════════════════════
-- Foto de perfil (avatar) — infra (Fase 1). Bucket PRIVADO + coluna de path.
--
-- A regra "foto do inquilino só depois do aceite" é aplicada no BACKEND (server
-- action que emite a URL assinada só quando podeVerAvatar = true). Aqui a RLS
-- garante que o bucket não é público e que só o dono (e o admin) tocam nos
-- arquivos. PROIBIDO reusar imagem do fluxo de verificação (CAF) — canal
-- separado, voluntário.
--
-- TODO(juridico): base legal, retenção e exclusão da foto de perfil + textos de
-- consentimento — item 13 do pacote da Beatriz.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists avatar_url text,          -- path INTERNO no bucket (não URL pública)
  add column if not exists avatar_atualizado_em timestamptz;

-- Bucket privado (URLs assinadas com expiração; nunca público).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Convenção de caminho: `<user_id>/<arquivo>.webp`. A 1ª pasta é o dono.

-- Leitura direta ao bucket: só o dono (ou admin). A foto de PROPRIETÁRIO chega
-- ao público por uma ROTA da app (thumb) que não expõe o bucket; a foto do
-- INQUILINO chega ao proprietário por URL assinada emitida SÓ após o aceite.
drop policy if exists "avatars: dono lê" on storage.objects;
create policy "avatars: dono lê"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Upload: só na própria pasta (canal voluntário, do zero — nunca a selfie CAF).
drop policy if exists "avatars: dono envia" on storage.objects;
create policy "avatars: dono envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Remoção: o dono pode remover a qualquer momento (apaga o arquivo); admin também
-- (moderação de avatar impróprio — Fase 3.4).
drop policy if exists "avatars: dono/admin removem" on storage.objects;
create policy "avatars: dono/admin removem"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
