-- ─────────────────────────────────────────────────────────────
-- Rodada 18 — vídeo walk-through do imóvel
-- Link do tour em vídeo (YouTube, Vimeo ou arquivo) exibido no anúncio.
-- ─────────────────────────────────────────────────────────────

alter table properties
  add column video_url text;
