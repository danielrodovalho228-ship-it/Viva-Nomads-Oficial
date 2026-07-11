-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DE QA (item 5) — imóvel-teste com qualificação APROVADA.
--
-- Objetivo: dar ao QA um imóvel para exercitar o EDITOR DE ANÚNCIO sem publicar
-- de verdade. O imóvel entra como `draft` → NÃO aparece na busca pública (o
-- getProperty só lê status='active'), mas aparece em "Meus imóveis" e abre no
-- editor. Idempotente: rodar de novo não duplica.
--
-- NÃO é uma migration (não roda em produção automaticamente). Rode MANUALMENTE
-- no SQL Editor do Supabase, no ambiente de teste/preview.
--
-- PASSO 1: troque o e-mail abaixo pelo da conta proprietario-teste.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_owner uuid;
  v_prop  uuid;
begin
  select id into v_owner
  from auth.users
  where email = 'proprietario-teste@EXEMPLO.com'   -- << TROQUE AQUI
  limit 1;

  if v_owner is null then
    raise notice 'Conta proprietario-teste não encontrada — ajuste o e-mail no script.';
    return;
  end if;

  -- Imóvel (idempotente pelo título de QA).
  select id into v_prop
  from public.properties
  where owner_id = v_owner and title = '[QA] Studio de teste — não publicar'
  limit 1;

  if v_prop is null then
    insert into public.properties (
      owner_id, title, description, property_type, city, address,
      lat, lng, bedrooms, bathrooms, area_m2, min_period_days, monthly_price,
      status, ready_to_live_score, ready_to_live_badge,
      tag_home_office, tag_work_located, tag_condo_approved,
      ownership_type, sublease_authorized, furnished
    ) values (
      v_owner,
      '[QA] Studio de teste — não publicar',
      'Imóvel de teste para o QA exercitar o editor de anúncio. Mantido como rascunho (não publicar).',
      'studio', 'Uberlândia', 'Centro',
      -18.9186, -48.2772, 1, 1, 35, 30, 2400,
      'draft', 85, true,
      true, false, true,
      'own', true, true
    )
    returning id into v_prop;
  end if;

  -- Qualificação aprovada vinculada ao dono (idempotente).
  if not exists (
    select 1 from public.qualification_checklists
    where owner_id = v_owner and status = 'approved'
  ) then
    insert into public.qualification_checklists (
      owner_id, furnished, accepts_30days, iptu_ok, habitable,
      is_owner_or_agent, condo_allows, eligible,
      ready_to_live_score, ready_to_live_badge,
      tag_home_office, tag_work_located, tag_condo_approved, internet_tier, status,
      -- Documento já verificado, para o QA conseguir PUBLICAR (item 1).
      document_status
    ) values (
      v_owner, true, true, true, true,
      true, 'yes', true,
      85, true,
      true, false, true, 'trabalho_remoto', 'approved',
      'approved'
    );
  end if;

  raise notice 'Seed QA ok — imóvel % (draft) + qualificação aprovada para %', v_prop, v_owner;
end $$;
