-- ROLLBACK da 0072: volta o gatilho da 0060 (salvar de novo, sem documento,
-- volta a zerar o documento — o bug). A coluna formulario fica (só dados; o app
-- grava sem ela se faltar).
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
commit;
