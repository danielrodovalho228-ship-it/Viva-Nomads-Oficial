-- 0212 — VÍDEO NO ANÚNCIO, parte 2: a página pública precisa LER o caminho do vídeo (ordem 8681ae95).
-- A 0053 revogou o SELECT de properties e liberou só as colunas públicas; video_arquivo (0211) fica de fora até entrar aqui
-- E em PROPERTY_PUBLIC_COLUMNS (src/lib/data/properties.ts). O caminho é só "<uid>/<arquivo>": sem dado pessoal;
-- o arquivo em si continua no bucket privado, lido pela política da 0211 (dono, ou anúncio publicado).
-- Idempotente (grant repetido não muda nada).
grant select (video_arquivo) on public.properties to anon, authenticated;
