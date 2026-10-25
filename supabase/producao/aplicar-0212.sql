-- Viva Nomads — aplicar 0212 (Vídeo no anúncio, parte 2: leitura pública do caminho — ordem 8681ae95). Idempotente. Rollback: supabase/producao/rollback/0212_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0212 — VÍDEO NO ANÚNCIO, parte 2: a página pública precisa LER o caminho do vídeo (ordem 8681ae95).
-- O caminho é só "<uid>/<arquivo>": sem dado pessoal; o arquivo continua no bucket privado (política da 0211).
grant select (video_arquivo) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000212', '0212_video_anuncio_leitura',
       array['-- conteúdo em supabase/migrations/0212_video_anuncio_leitura.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000212');
commit;
