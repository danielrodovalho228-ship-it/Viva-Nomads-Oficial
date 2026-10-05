-- ─────────────────────────────────────────────────────────────────────────────
-- 0072 — qualificação: salvar de novo NÃO apaga o documento aprovado. Idempotente.
--
-- Cada "Salvar qualificação" grava uma NOVA linha, e o editor/o banco usam a
-- mais recente do imóvel. Sem documento novo anexado, a linha nascia com
-- document_status = 'none' — o proprietário que salvava de novo depois da
-- aprovação perdia a aprovação e o Publicar travava outra vez.
--
--  1. Gatilho qualificacao_protege_revisao (0060): no INSERT do dono SEM
--     documento novo, herda documento + revisão da qualificação anterior do
--     MESMO imóvel. Documento novo continua entrando "em análise" do zero.
--     O dono continua sem poder escrever status/revisão (a herança é do banco).
--  2. formulario jsonb: o estado completo da tela (requisitos e qualidade),
--     para o /qualificar abrir preenchido em vez de 0/6.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.qualification_checklists add column if not exists formulario jsonb;

create or replace function public.qualificacao_protege_revisao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  servidor boolean := current_user in ('service_role', 'supabase_admin', 'postgres');
  prev record;
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
      if new.document_path is null then
        -- Nova qualificação SEM documento novo: herda o documento e a revisão
        -- da qualificação anterior do MESMO imóvel (ou da que está à espera).
        -- Antes, salvar de novo zerava o documento aprovado → Publicar travava.
        select q.document_path, q.document_hash_sha256, q.document_uploaded_at, q.document_status,
               q.document_review_reason, q.document_reviewed_at, q.document_reviewed_by
          into prev
          from public.qualification_checklists q
         where q.owner_id = new.owner_id
           and q.property_id is not distinct from new.property_id
           and q.document_path is not null
         order by q.created_at desc
         limit 1;
        if found then
          new.document_path := prev.document_path;
          new.document_hash_sha256 := prev.document_hash_sha256;
          new.document_uploaded_at := prev.document_uploaded_at;
          new.document_status := prev.document_status;
          new.document_review_reason := prev.document_review_reason;
          new.document_reviewed_at := prev.document_reviewed_at;
          new.document_reviewed_by := prev.document_reviewed_by;
          return new;
        end if;
      end if;
      -- Documento NOVO (ou nenhum antes): entra em análise do zero.
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

-- (o gatilho trg da 0060 continua apontando para esta função)

-- Conferência (rodar depois):
--   select pg_get_functiondef('public.qualificacao_protege_revisao()'::regprocedure) like '%prev.document_status%';  -- true
