-- ════════════════════════════════════════════════════════════════════════════
-- 0060 — Qualificação POR IMÓVEL (PR 6, P1). Antes, a liberação de Publicar,
-- os selos/etiquetas e a contagem do Gestor liam "a última qualificação do
-- DONO": um documento aprovado liberava todos os imóveis, um documento novo
-- travava os já publicados e o mesmo arquivo enviado 5 vezes contava como 5.
--
--   1. qualification_checklists.property_id: só um imóvel do PRÓPRIO dono;
--      depois de ligado não muda. O dono não edita o checklist depois de
--      gravado (selos, nota, elegibilidade) — só liga o imóvel (null → seu).
--   2. properties_protege_campos: selos/etiquetas e a liberação de publicar
--      vêm da qualificação DESTE imóvel (property_id = new.id).
--   3. Registros antigos sem imóvel: ligados ao imóvel do dono quando ele tem
--      exatamente 1; nos demais casos ficam sem imóvel (precisa reenviar).
--
-- Aplicar DEPOIS do deploy do código deste PR (o código novo cria o imóvel
-- como rascunho, liga a qualificação e só então publica). Idempotente.
-- Rollback: supabase/producao/rollback/0060_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists qualification_checklists_imovel_idx
  on public.qualification_checklists (property_id, created_at desc);

-- ── 1. checklist: imóvel do próprio dono, ligado uma vez, sem edição ───────
create or replace function public.qualificacao_protege_revisao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  servidor boolean := current_user in ('service_role', 'supabase_admin', 'postgres');
begin
  -- Imóvel ligado tem de ser do dono do checklist (vale para todos, exceto servidor).
  if not servidor
     and new.property_id is not null
     and (tg_op = 'INSERT' or new.property_id is distinct from old.property_id)
     and not exists (
       select 1 from public.properties p
        where p.id = new.property_id and p.owner_id = new.owner_id
     )
  then
    raise exception 'Imóvel não pertence ao dono do checklist' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not servidor then
      new.document_status := case when new.document_path is not null then 'pending' else 'none' end;
      new.document_review_reason := null;
      new.document_reviewed_at := null;
      new.document_reviewed_by := null;
    end if;
    return new;
  end if;

  if servidor then
    return new;
  end if;

  -- Revisão (status/documento): só a equipe, nunca no próprio.
  if new.document_status        is distinct from old.document_status
     or new.document_review_reason is distinct from old.document_review_reason
     or new.document_reviewed_at   is distinct from old.document_reviewed_at
     or new.document_reviewed_by   is distinct from old.document_reviewed_by
     or new.status                 is distinct from old.status
  then
    if not public.is_admin() then
      raise exception 'Somente a equipe Viva Nomads revisa documentos' using errcode = '42501';
    end if;
    if old.owner_id = auth.uid() then
      raise exception 'Ninguém revisa o próprio documento' using errcode = '42501';
    end if;
  end if;

  -- Imóvel: liga uma vez (null → imóvel do dono); depois não troca.
  if old.property_id is not null and new.property_id is distinct from old.property_id then
    raise exception 'O checklist já pertence a outro imóvel' using errcode = '42501';
  end if;

  -- O dono não altera mais nada no checklist gravado (selos, nota, documento):
  -- para mudar, envia uma nova qualificação. Admin só revisa (acima).
  if not public.is_admin()
     and (to_jsonb(new) - 'property_id') is distinct from (to_jsonb(old) - 'property_id')
  then
    raise exception 'Alteração não permitida no checklist — envie uma nova qualificação'
      using errcode = '42501';
  end if;
  if public.is_admin()
     and (new.owner_id is distinct from old.owner_id
          or new.document_path is distinct from old.document_path
          or new.document_hash_sha256 is distinct from old.document_hash_sha256)
  then
    raise exception 'Alteração não permitida no checklist' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── 2. anúncio: selos e liberação pela qualificação DESTE imóvel ────────────
create or replace function public.properties_protege_campos()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  q record;
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres')
     or pg_trigger_depth() > 1
     or public.is_admin()
  then
    return new;
  end if;

  select qc.document_status, qc.ready_to_live_score, qc.ready_to_live_badge,
         qc.tag_home_office, qc.tag_work_located, qc.tag_condo_approved
    into q
    from public.qualification_checklists qc
   where qc.property_id = new.id
     and qc.owner_id = new.owner_id
   order by qc.created_at desc
   limit 1;

  -- Selos/etiquetas = os da qualificação DESTE imóvel (não o que a tela manda).
  new.ready_to_live_score := coalesce(q.ready_to_live_score, 0);
  new.ready_to_live_badge := coalesce(q.ready_to_live_badge, false);
  new.tag_home_office     := coalesce(q.tag_home_office, false);
  new.tag_work_located    := coalesce(q.tag_work_located, false);
  new.tag_condo_approved  := coalesce(q.tag_condo_approved, false);

  if tg_op = 'INSERT' then
    new.photo_count          := 0;
    new.listing_quality_tier := 'padrao';
    new.rating               := 0;
    new.review_count         := 0;
    new.work_ready_badge     := false;
    new.work_score           := 0;
  else
    new.photo_count          := old.photo_count;
    new.listing_quality_tier := old.listing_quality_tier;
    new.rating               := old.rating;
    new.review_count         := old.review_count;
    new.work_ready_badge     := old.work_ready_badge;
    new.work_score           := old.work_score;
  end if;

  -- Publicar exige o documento DESTE imóvel aprovado.
  if new.status::text = 'active'
     and (tg_op = 'INSERT' or old.status::text is distinct from 'active')
     and coalesce(q.document_status, 'none') <> 'approved'
  then
    raise exception 'Documentação do imóvel ainda não aprovada' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── 3. registros antigos: dono com UM imóvel → liga; demais ficam sem imóvel ─
update public.qualification_checklists qc
   set property_id = u.property_id
  from (
    select owner_id, min(id::text)::uuid as property_id
      from public.properties
     group by owner_id
    having count(*) = 1
  ) u
 where qc.property_id is null
   and qc.owner_id = u.owner_id;
