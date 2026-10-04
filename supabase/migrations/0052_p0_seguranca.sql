-- ════════════════════════════════════════════════════════════════════════════
-- 0052 — P0 de segurança (CRÍTICO). Fecha 4 furos exploráveis hoje:
--   C1  cadastro não pode criar admin;
--   C2  usuário não altera o próprio role / campos de confiança;
--   C3  RPCs de contato (PII) só pelo servidor; messages/leads com relação real;
--   C4  colunas sensíveis de properties fora do alcance público; draft_data limpo.
--   PJ1 o cadastro passa a gravar person_type (PF/PJ) — antes era descartado.
--       Não corrige contas já criadas: ver o SELECT de conferência no
--       verificar-seguranca.sql (ajuste manual, se houver PJ errado).
--
-- ⚠️ NÃO aplicar sem revisão. Depende de migrações já aplicadas (0001, 0013,
--    0017, 0023, 0024, 0027, 0028, 0046, 0043). Aplique você. Rode o
--    supabase/producao/verificar-seguranca.sql ANTES e DEPOIS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── C1 — handle_new_user só aceita 'owner' | 'tenant' ───────────────────────
-- Antes (0013) aceitava 'admin' vindo de raw_user_meta_data (controlado pelo
-- cliente) → qualquer cadastro virava admin. Admin agora só por SQL manual.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, person_type)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- SÓ owner|tenant. Qualquer outro valor (inclusive 'admin') → 'tenant'.
    case
      when new.raw_user_meta_data ->> 'role' in ('owner', 'tenant')
        then (new.raw_user_meta_data ->> 'role')::user_role
      else 'tenant'::user_role
    end,
    -- PJ1: a escolha PF/PJ do cadastro era descartada (todos ficavam 'pf').
    case
      when new.raw_user_meta_data ->> 'person_type' = 'pj' then 'pj'::person_type
      else 'pf'::person_type
    end
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user: % (%):', sqlerrm, sqlstate;
    return new;
end;
$$;

-- ── C2 — perfil próprio não reescreve role/confiança ────────────────────────
-- A política "perfil próprio" (0001) é FOR ALL sem limitar coluna e não havia
-- grant por coluna. Agora: UPDATE só nas colunas de preferência + trigger que
-- barra as colunas de confiança para quem não for service_role.
revoke update on public.profiles from authenticated, anon;
grant update (
  full_name, phone, avatar_url, avatar_atualizado_em, preferred_mode,
  professional_category, linkedin_url, company_name, needs_nfse,
  notif_email, notif_whatsapp
) on public.profiles to authenticated;

create or replace function public.profiles_bloqueia_confianca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (server actions) e papéis de migração podem tudo; usuário não.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if new.role               is distinct from old.role
     or new.email           is distinct from old.email
     or new.is_verified      is distinct from old.is_verified
     or new.verification_progress is distinct from old.verification_progress
     or new.fundador         is distinct from old.fundador
     or new.fundador_em      is distinct from old.fundador_em
     or new.account_type     is distinct from old.account_type
     or new.cpf              is distinct from old.cpf
     or new.person_type      is distinct from old.person_type
     or new.anonymized_at    is distinct from old.anonymized_at
  then
    raise exception 'Alteração de campo protegido do perfil não permitida'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_bloqueia_confianca on public.profiles;
create trigger trg_profiles_bloqueia_confianca
  before update on public.profiles
  for each row execute function public.profiles_bloqueia_confianca();

-- ── C3 — RPCs de contato (PII) só pelo servidor ─────────────────────────────
-- Tiram o execute de authenticated/anon (qualquer logado colhia e-mail/telefone
-- em massa). Passam a rodar só com service_role, dentro das server actions que
-- já validam a relação.
revoke execute on function public.owner_notify_contact(uuid)       from authenticated, anon;
revoke execute on function public.message_notify_contact(uuid)     from authenticated, anon;
revoke execute on function public.pedido_owner_recipients(text)    from authenticated, anon;
revoke execute on function public.pedido_inquilino_recipient(uuid) from authenticated, anon;
grant  execute on function public.owner_notify_contact(uuid)       to service_role;
grant  execute on function public.message_notify_contact(uuid)     to service_role;
grant  execute on function public.pedido_owner_recipients(text)    to service_role;
grant  execute on function public.pedido_inquilino_recipient(uuid) to service_role;

-- messages INSERT: só com relação REAL entre as partes — um lead (candidatura
-- OU dúvida/visita, qualquer status) OU uma resposta a Pedido de Moradia. Cobre
-- os dois sentidos (inquilino↔proprietário).
drop policy if exists "enviar mensagem" on public.messages;
create policy "enviar mensagem" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.leads l
        where (l.tenant_id = auth.uid() and l.owner_id = messages.receiver_id)
           or (l.owner_id  = auth.uid() and l.tenant_id = messages.receiver_id)
      )
      or exists (
        select 1 from public.respostas_pedido r
        join public.pedidos_moradia p on p.id = r.pedido_id
        where (r.proprietario_id = auth.uid() and p.inquilino_id = messages.receiver_id)
           or (p.inquilino_id    = auth.uid() and r.proprietario_id = messages.receiver_id)
      )
    )
  );

-- leads INSERT: só o próprio inquilino, status 'new', e owner_id = dono REAL de
-- um imóvel ATIVO (não dá para forjar owner_id nem status).
drop policy if exists "inquilino cria lead" on public.leads;
create policy "inquilino cria lead" on public.leads
  for insert with check (
    tenant_id = auth.uid()
    and status = 'new'
    and exists (
      select 1 from public.properties p
      where p.id = leads.property_id
        and p.status = 'active'
        and p.owner_id = leads.owner_id
    )
  );

-- ── C4 — colunas sensíveis de properties fora do alcance público ────────────
-- A política de SELECT é por LINHA (expõe TODAS as colunas das linhas ativas).
-- Trocamos por privilégio de COLUNA: anon/authenticated só leem colunas seguras;
-- exact_address, responsavel_local_* e draft_data ficam inacessíveis via
-- PostgREST. O dono e o inquilino ACEITO leem os campos privados pela RPC abaixo.
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

-- Detalhes privados: endereço exato + responsável local (dono OU inquilino com
-- candidatura ACEITA); draft_data só para o dono.
create or replace function public.property_private_details(prop_id uuid)
returns table (
  exact_address text,
  responsavel_local_nome text,
  responsavel_local_telefone text,
  responsavel_local_email text,
  draft_data jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    p.exact_address,
    p.responsavel_local_nome,
    p.responsavel_local_telefone,
    p.responsavel_local_email,
    case when p.owner_id = auth.uid() then p.draft_data else null end
  from public.properties p
  where p.id = prop_id
    and (
      p.owner_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.leads l
        where l.property_id = p.id
          and l.tenant_id = auth.uid()
          and l.status = 'accepted'
      )
    )
  limit 1;
$$;

revoke all on function public.property_private_details(uuid) from public, anon;
grant execute on function public.property_private_details(uuid) to authenticated;

-- Limpa o draft_data (snapshot do editor, com a RUA) das linhas JÁ publicadas.
update public.properties set draft_data = null
 where status = 'active' and draft_data is not null;
