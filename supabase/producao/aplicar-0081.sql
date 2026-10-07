-- Viva Nomads — aplicar 0081 (exclusão de conta não trava em chamados e referências).
-- SQL Editor ou ferramenta do Supabase: nenhum comando gera NOTICE. Reaplicar é seguro.
-- Conteúdo = supabase/migrations/0081_exclusao_conta_chamados.sql + registro no histórico.
begin;
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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000081', '0081_exclusao_conta_chamados',
       array['-- conteúdo em supabase/migrations/0081_exclusao_conta_chamados.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000081');
commit;

-- Conferência (só leitura): sem chamados_check; gatilho no INSERT; as 6 FKs com
-- ação 'n' (set null); a versão no histórico.
select count(*) as chamados_check from pg_constraint
 where conrelid = 'public.chamados'::regclass and conname = 'chamados_check';
select tgname, tgenabled from pg_trigger where tgrelid = 'public.chamados'::regclass and tgname = 'chamados_exige_dono';
select conrelid::regclass as tabela, conname, confdeltype from pg_constraint
 where conname in ('chamados_usuario_id_fkey', 'profiles_referred_by_fkey', 'properties_responsavel_local_user_id_fkey',
                   'leads_decided_by_fkey', 'account_type_audit_changed_by_fkey',
                   'qualification_checklists_document_reviewed_by_fkey')
 order by 1;
select version, name from supabase_migrations.schema_migrations where version = '20261007000081';
