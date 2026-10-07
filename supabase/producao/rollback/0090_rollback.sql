-- Rollback da 0090: volta o gatilho e a permissão da razão social como na 0054/0052.
-- Mantém a coluna cpf_representante (dado gravado não se perde). Rodar no SQL Editor
-- (tem DROP; o conector não executa).
begin;
set local lock_timeout = '5s';
alter table public.profiles drop constraint if exists profiles_cpf_valido_ck;
alter table public.profiles drop constraint if exists profiles_cnpj_valido_ck;
alter table public.profiles drop constraint if exists profiles_cpf_representante_ck;
drop index if exists public.profiles_cpf_unico;
grant update (company_name) on public.profiles to authenticated;

create or replace function public.profiles_bloqueia_confianca()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if new.role                  is distinct from old.role
     or new.email                 is distinct from old.email
     or new.is_verified           is distinct from old.is_verified
     or new.verification_progress is distinct from old.verification_progress
     or new.fundador              is distinct from old.fundador
     or new.fundador_em           is distinct from old.fundador_em
     or new.account_type          is distinct from old.account_type
     or new.cpf                   is distinct from old.cpf
     or new.person_type           is distinct from old.person_type
     or new.anonymized_at         is distinct from old.anonymized_at
     or new.referred_by           is distinct from old.referred_by
     or new.referral_code         is distinct from old.referral_code
  then
    raise exception 'Alteração de campo protegido do perfil não permitida'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop function if exists public.cpf_valido(text);
drop function if exists public.cnpj_valido(text);
commit;
