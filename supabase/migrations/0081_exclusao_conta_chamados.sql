-- 0081 — Exclusão de conta não trava mais em chamados e referências (P1, LGPD).
--
-- Apagar um usuário (fluxo /excluir-conta ou painel do Supabase) falhava em:
--  - chamados: o FK deixa usuario_id vazio, mas a CHECK "usuário ou e-mail"
--    barrava. Agora a regra é um gatilho só no INSERT: chamado novo continua
--    exigindo usuário ou e-mail; o antigo fica no histórico sem dados pessoais.
--    Mensagens e eventos do chamado já ficavam sem autor (SET NULL) e não travam.
--  - 5 FKs sem ação (NO ACTION) para o perfil/usuário: quem indicou outra pessoa,
--    responsável local de imóvel, quem decidiu um lead, quem mudou o tipo de
--    conta e quem revisou documento. Passam a SET NULL (colunas já aceitam nulo).
-- Fica de fora: vistorias.executor_id e vistoria_fotos.autor_id (NOT NULL),
-- decididos na vistoria V1.
-- Sem comandos que gerem NOTICE (reaplicar é seguro).

-- 1) Chamado: a regra "usuário ou e-mail" passa a valer só para chamado NOVO.
--    Ao apagar a conta, o chamado fica no histórico sem dono (usuario_id nulo).
do $$
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'public.chamados'::regclass and conname = 'chamados_check') then
    alter table public.chamados drop constraint chamados_check;
  end if;
end $$;

create or replace function public.chamados_exige_dono() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.usuario_id is null and new.visitante_email is null then
    raise exception 'chamado sem usuário nem e-mail' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.chamados_exige_dono() from public, anon, authenticated;

create or replace trigger chamados_exige_dono before insert on public.chamados
  for each row execute function public.chamados_exige_dono();

-- 2) Referências que bloqueavam a exclusão (NO ACTION) passam a ficar vazias.
alter table public.profiles
  drop constraint profiles_referred_by_fkey,
  add constraint profiles_referred_by_fkey foreign key (referred_by)
    references public.profiles(id) on delete set null;
alter table public.properties
  drop constraint properties_responsavel_local_user_id_fkey,
  add constraint properties_responsavel_local_user_id_fkey foreign key (responsavel_local_user_id)
    references auth.users(id) on delete set null;
alter table public.leads
  drop constraint leads_decided_by_fkey,
  add constraint leads_decided_by_fkey foreign key (decided_by)
    references public.profiles(id) on delete set null;
alter table public.account_type_audit
  drop constraint account_type_audit_changed_by_fkey,
  add constraint account_type_audit_changed_by_fkey foreign key (changed_by)
    references public.profiles(id) on delete set null;
alter table public.qualification_checklists
  drop constraint qualification_checklists_document_reviewed_by_fkey,
  add constraint qualification_checklists_document_reviewed_by_fkey foreign key (document_reviewed_by)
    references auth.users(id) on delete set null;
