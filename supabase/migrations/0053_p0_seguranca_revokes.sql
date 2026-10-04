-- ════════════════════════════════════════════════════════════════════════════
-- 0053 — P0 de segurança, PARTE 2 (REVOKES). Aplicar SÓ DEPOIS que o deploy do
-- merge do PR P0 estiver no ar.
--
-- Esta parte QUEBRARIA a `main` antiga (select("*") em properties e RPCs de
-- contato chamadas pela sessão). O código do PR já não faz nenhuma das duas
-- coisas: lê properties por lista explícita de colunas e chama as RPCs com
-- service role.
--
--   C3b  RPCs de contato (PII) sem execute para anon/authenticated.
--   C4b  properties com SELECT POR COLUNA: exact_address, responsavel_local_*,
--        draft_data e sublease_doc_url saem do alcance de anon/authenticated.
--   C4c  repete a limpeza do draft_data (anúncios publicados pela main antiga
--        entre a 0052 e o merge ainda podem ter ficado com ele).
--
-- Pré-requisito: 0052 aplicada (property_private_details e o grant ao
-- service_role vêm de lá).
-- Rollback: supabase/producao/rollback/0053_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── C3b — RPCs de contato só pelo servidor ──────────────────────────────────
revoke execute on function public.owner_notify_contact(uuid)       from authenticated, anon;
revoke execute on function public.message_notify_contact(uuid)     from authenticated, anon;
revoke execute on function public.pedido_owner_recipients(text)    from authenticated, anon;
revoke execute on function public.pedido_inquilino_recipient(uuid) from authenticated, anon;

-- ── C4b — SELECT por coluna em properties ───────────────────────────────────
-- A política de SELECT é por LINHA (expõe TODAS as colunas das linhas ativas).
-- Com privilégio de COLUNA, anon/authenticated só leem as colunas abaixo.
-- ⚠️ Coluna nova em properties precisa entrar aqui (numa nova migração) E em
--    PROPERTY_PUBLIC_COLUMNS (src/lib/data/properties.ts), senão some do site.
--    O `npm run check:migracoes` avisa quando há coluna fora das listas.
revoke select on public.properties from anon, authenticated;
grant select (
  id, owner_id, title, description, property_type, city, state, address,
  lat, lng, bedrooms, bathrooms, area_m2, min_period_days, monthly_price,
  utilities_mode, utilities_estimate, utilities_overage_margin, prep_fee,
  checkout_cleaning_enabled, checkout_cleaning_fee, issues_invoice,
  accepts_insurance, rating, review_count, status, ready_to_live_badge,
  ready_to_live_score, tag_home_office, tag_work_located, tag_condo_approved,
  ownership_type, sublease_authorized, video_url, created_at, faixas_aceitas,
  garantias_aceitas, google_places, parking_spots, condo_fee,
  descricao_gerada_por_ia, available_from, furnished, pets_allowed,
  smoking_allowed, children_allowed, max_guests, available_until,
  max_period_days, checkin_after, checkout_before
) on public.properties to anon, authenticated;

-- ── C4c — limpeza final do draft_data ───────────────────────────────────────
insert into public._backup_p0_draft_data (property_id, draft_data, migracao)
select id, draft_data, '0053'
from public.properties
where status = 'active' and draft_data is not null
on conflict (property_id) do nothing;

update public.properties set draft_data = null
 where status = 'active' and draft_data is not null;
