-- ─────────────────────────────────────────────────────────────
-- FASE 1 (delta): campos que faltavam para cadastro/filtros/página.
-- Opcionais e idempotentes. (parking_spots, condo_fee, available_from,
-- furnished, pets_allowed, smoking_allowed, max_guests, checkin/out já vieram
-- na 0018; tipos e comodidades usam property_type texto + property_amenities.)
-- ─────────────────────────────────────────────────────────────

alter table properties add column if not exists available_until date;      -- disponível até
alter table properties add column if not exists max_period_days int;        -- duração máxima
alter table properties add column if not exists children_allowed boolean;   -- aceita crianças

-- Observação: "garantia aceita" no filtro reusa o que já existe —
--   caução / título  → coluna garantias_aceitas (array de chaves)
--   seguro-fiança    → coluna accepts_insurance (boolean)
-- por isso não criamos colunas booleanas novas de garantia.
