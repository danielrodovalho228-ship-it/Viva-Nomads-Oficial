-- ─────────────────────────────────────────────────────────────
-- Proximidades via Google (curado pelo proprietário). REGRA DO GOOGLE:
-- guardamos APENAS o place_id (+ categoria e rótulo opcional). Nome, endereço
-- e distância são buscados EM TEMPO REAL na página (nunca persistidos).
-- Idempotente.
-- ─────────────────────────────────────────────────────────────

-- Array de { place_id, categoria, rotulo }. Ex.:
--   [{"place_id":"ChIJ...","categoria":"coworking","rotulo":"ASA Coworking"}]
alter table properties
  add column if not exists google_places jsonb not null default '[]'::jsonb;
