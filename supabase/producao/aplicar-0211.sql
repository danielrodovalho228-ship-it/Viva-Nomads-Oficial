-- Viva Nomads — aplicar 0211 (Vídeo curto no anúncio, parte 1 — ordem 8681ae95). Idempotente. Rollback: supabase/producao/rollback/0211_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0211 — VÍDEO CURTO NO ANÚNCIO (ordem 8681ae95, parte 1: banco e validação no servidor).
-- • properties.video_arquivo: caminho do vídeo enviado (1 por anúncio), sempre na pasta do dono: "<uid>/<arquivo>".
-- • Bucket PRIVADO anuncio-videos: MP4/MOV, até 50 MB (o bucket recusa maior/outro tipo mesmo que burlem o navegador).
--   A duração (60 s) e o tipo real são conferidos pelo servidor em src/lib/video-anuncio.ts, que apaga o arquivo recusado.
-- • RLS: só o dono envia e apaga na própria pasta; leitura: o dono, ou qualquer pessoa SÓ se o arquivo é o vídeo
--   de um anúncio publicado (status 'active'). Rascunho e pausado não vazam.
-- Sem dado pessoal. Idempotente; só cria coisas novas.
alter table public.properties add column if not exists video_arquivo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.properties'::regclass and conname = 'properties_video_arquivo_pasta') then
    alter table public.properties add constraint properties_video_arquivo_pasta
      check (video_arquivo is null or (char_length(video_arquivo) <= 200 and video_arquivo like owner_id::text || '/%'));
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anuncio-videos', 'anuncio-videos', false, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'anuncio-videos: dono envia') then
    create policy "anuncio-videos: dono envia" on storage.objects for insert to authenticated
      with check (bucket_id = 'anuncio-videos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'anuncio-videos: dono apaga') then
    create policy "anuncio-videos: dono apaga" on storage.objects for delete to authenticated
      using (bucket_id = 'anuncio-videos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'anuncio-videos: le dono ou publicado') then
    create policy "anuncio-videos: le dono ou publicado" on storage.objects for select to anon, authenticated
      using (
        bucket_id = 'anuncio-videos'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or exists (select 1 from public.properties p where p.video_arquivo = storage.objects.name and p.status = 'active')
        )
      );
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000211', '0211_video_anuncio',
       array['-- conteúdo em supabase/migrations/0211_video_anuncio.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000211');
commit;
