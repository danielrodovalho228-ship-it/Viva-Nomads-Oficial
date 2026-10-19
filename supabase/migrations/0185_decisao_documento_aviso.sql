-- 0185 — Decisão de documento: avisar o dono UMA vez por imóvel (rota rápida dos e-mails, item 3b).
--  1. decisao_avisada_em nas duas filas (qualificação e matrícula): quando a decisão da equipe já foi avisada.
--     O que já estava decidido antes desta migração conta como avisado (o e-mail antigo já saiu).
--  2. decisoes_documento_para_avisar(dono, imóvel, forçar): se ainda há documento do mesmo imóvel na fila, não
--     devolve nada (o aviso espera); senão, marca as decisões ainda não avisadas e devolve uma linha por decisão.
--     Trava por dono+imóvel (pg_advisory_xact_lock) e marca com "update … returning": duas decisões quase
--     simultâneas nunca geram dois e-mails. `forçar` = rede de segurança do cron (avisa mesmo com fila).
--  3. decisoes_documento_atrasadas(horas): pares dono+imóvel com decisão não avisada há mais de N horas (cron diário).
-- Só o servidor (service_role) chama as funções. Reaplicar é seguro.

alter table public.qualification_checklists add column if not exists decisao_avisada_em timestamptz;
alter table public.property_ownership_checks add column if not exists decisao_avisada_em timestamptz;
comment on column public.qualification_checklists.decisao_avisada_em is 'Quando a decisão da equipe foi avisada ao dono (0185). Nulo ou anterior a document_reviewed_at = falta avisar.';
comment on column public.property_ownership_checks.decisao_avisada_em is 'Quando a decisão da equipe foi avisada ao dono (0185). Nulo ou anterior a revisado_em = falta avisar.';

update public.qualification_checklists
   set decisao_avisada_em = coalesce(document_reviewed_at, now())
 where document_status in ('approved', 'rejected') and decisao_avisada_em is null;
update public.property_ownership_checks
   set decisao_avisada_em = coalesce(revisado_em, now())
 where revisado_em is not null and decisao_avisada_em is null;

create or replace function public.decisoes_documento_para_avisar(p_owner uuid, p_property uuid, p_forcar boolean default false)
returns table (origem text, ref_id uuid, documento_path text, aprovado boolean, motivo text, decidido_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pendentes int;
begin
  perform pg_advisory_xact_lock(hashtextextended('decisao_documento:' || p_owner::text || ':' || coalesce(p_property::text, '-'), 0));
  if not coalesce(p_forcar, false) then
    select count(*) into v_pendentes from (
      select 1 from public.qualification_checklists q
       where q.owner_id = p_owner and q.property_id is not distinct from p_property
         and q.document_status = 'pending' and q.document_path is not null
      union all
      select 1 from public.property_ownership_checks m
       where m.user_id = p_owner and m.property_id is not distinct from p_property
         and m.resultado = 'em_revisao' and m.revisado_em is null
    ) fila;
    if v_pendentes > 0 then
      return;
    end if;
  end if;
  return query
  with q as (
    update public.qualification_checklists q
       set decisao_avisada_em = greatest(now(), q.document_reviewed_at)
     where q.owner_id = p_owner and q.property_id is not distinct from p_property
       and q.document_status in ('approved', 'rejected')
       and q.document_reviewed_by is not null
       and q.conferido_por is distinct from 'automatico'
       and (q.decisao_avisada_em is null or q.decisao_avisada_em < q.document_reviewed_at)
    returning 'qualificacao'::text as o, q.id as i, q.document_path as d, (q.document_status = 'approved') as a, q.document_review_reason as r, q.document_reviewed_at as t
  ), m as (
    update public.property_ownership_checks m
       set decisao_avisada_em = greatest(now(), m.revisado_em)
     where m.user_id = p_owner and m.property_id is not distinct from p_property
       and m.revisado_por is not null and m.revisado_em is not null
       and (m.decisao_avisada_em is null or m.decisao_avisada_em < m.revisado_em)
    returning 'matricula'::text as o, m.id as i, m.arquivo_path as d, (m.resultado = 'conferido') as a, m.revisao_motivo as r, m.revisado_em as t
  )
  select q.o, q.i, q.d, q.a, q.r, q.t from q
  union all
  select m.o, m.i, m.d, m.a, m.r, m.t from m;
end;
$$;

create or replace function public.decisoes_documento_atrasadas(p_horas int default 2)
returns table (owner_id uuid, property_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct x.owner_id, x.property_id from (
    select q.owner_id, q.property_id from public.qualification_checklists q
     where q.document_status in ('approved', 'rejected') and q.document_reviewed_by is not null
       and q.conferido_por is distinct from 'automatico'
       and (q.decisao_avisada_em is null or q.decisao_avisada_em < q.document_reviewed_at)
       and q.document_reviewed_at < now() - make_interval(hours => greatest(coalesce(p_horas, 2), 1))
    union all
    select m.user_id, m.property_id from public.property_ownership_checks m
     where m.revisado_por is not null and m.revisado_em is not null
       and (m.decisao_avisada_em is null or m.decisao_avisada_em < m.revisado_em)
       and m.revisado_em < now() - make_interval(hours => greatest(coalesce(p_horas, 2), 1))
  ) x;
$$;

revoke all on function public.decisoes_documento_para_avisar(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.decisoes_documento_atrasadas(int) from public, anon, authenticated;
grant execute on function public.decisoes_documento_para_avisar(uuid, uuid, boolean) to service_role;
grant execute on function public.decisoes_documento_atrasadas(int) to service_role;
