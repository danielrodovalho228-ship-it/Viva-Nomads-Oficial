-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0060 (qualificacao_por_imovel). Volta as funções da 0056.
-- ⚠️ Volta a valer "a última qualificação do DONO" (um documento libera todos
--    os imóveis). Os property_id ligados pela 0060 ficam (não atrapalham).
-- Rode tudo de uma vez no SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create or replace function public.qualificacao_protege_revisao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  servidor boolean := current_user in ('service_role', 'supabase_admin', 'postgres');
begin
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
  if new.owner_id is distinct from old.owner_id
     or new.document_path is distinct from old.document_path
     or new.document_hash_sha256 is distinct from old.document_hash_sha256
  then
    raise exception 'Alteração não permitida no checklist' using errcode = '42501';
  end if;
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
  return new;
end;
$$;

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
   where qc.owner_id = new.owner_id
   order by qc.created_at desc
   limit 1;

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

  if new.status::text = 'active'
     and (tg_op = 'INSERT' or old.status::text is distinct from 'active')
     and coalesce(q.document_status, 'none') <> 'approved'
  then
    raise exception 'Documentação do imóvel ainda não aprovada' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop index if exists public.qualification_checklists_imovel_idx;
commit;
