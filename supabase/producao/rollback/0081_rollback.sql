-- Rollback da 0081: volta a CHECK do chamado e as 5 FKs sem ação.
-- Atenção: a CHECK só volta se nenhum chamado ficou sem dono (contas já apagadas);
-- nesse caso, ela é recriada NOT VALID (vale para linhas novas).
begin;
drop trigger chamados_exige_dono on public.chamados;
drop function public.chamados_exige_dono();
alter table public.chamados add constraint chamados_check
  check ((usuario_id is not null) or (visitante_email is not null)) not valid;
alter table public.profiles drop constraint profiles_referred_by_fkey,
  add constraint profiles_referred_by_fkey foreign key (referred_by) references public.profiles(id);
alter table public.properties drop constraint properties_responsavel_local_user_id_fkey,
  add constraint properties_responsavel_local_user_id_fkey foreign key (responsavel_local_user_id) references auth.users(id);
alter table public.leads drop constraint leads_decided_by_fkey,
  add constraint leads_decided_by_fkey foreign key (decided_by) references public.profiles(id);
alter table public.account_type_audit drop constraint account_type_audit_changed_by_fkey,
  add constraint account_type_audit_changed_by_fkey foreign key (changed_by) references public.profiles(id);
alter table public.qualification_checklists drop constraint qualification_checklists_document_reviewed_by_fkey,
  add constraint qualification_checklists_document_reviewed_by_fkey foreign key (document_reviewed_by) references auth.users(id);
delete from supabase_migrations.schema_migrations where version = '20261007000081';
commit;
