-- 0090 — DOCUMENTO DA PESSOA (CPF ou CNPJ). PRECISA APROVAÇÃO DO DANIEL — não aplicado.
-- Pacote "Cadastro confiável" (07/10/2026). Em produção, 0 de 9 contas têm CPF/CNPJ,
-- mas o fechamento, a cobrança e o fiscal leem esses campos.
--   • profiles.cpf_representante (PJ: CPF de quem representa a empresa);
--   • dígitos verificadores conferidos NO BANCO (cpf_valido / cnpj_valido);
--   • um CPF por conta (anti-fraude); CNPJ pode repetir (empresa com mais de um login);
--   • cpf, cnpj, razão social e CPF do representante só mudam pelo servidor
--     (a tela grava pela server action, que valida; o usuário não edita direto).
-- Só colunas/funções novas; restrições NOT VALID (valem para o que for gravado daqui
-- em diante; hoje não há documento gravado). Sem DROP, sem NOTICE.

create or replace function public.cpf_valido(v text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(v, ''), '\D', '', 'g');
  s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end;
$$;

create or replace function public.cnpj_valido(v text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(v, ''), '\D', '', 'g');
  p1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  p2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
begin
  if length(d) <> 14 or d ~ '^(\d)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * p1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * p2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end;
$$;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'cpf_representante') then
    alter table public.profiles add column cpf_representante text;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cpf_valido_ck') then
    alter table public.profiles add constraint profiles_cpf_valido_ck check (cpf is null or (cpf ~ '^\d{11}$' and public.cpf_valido(cpf))) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cnpj_valido_ck') then
    alter table public.profiles add constraint profiles_cnpj_valido_ck check (cnpj is null or (cnpj ~ '^\d{14}$' and public.cnpj_valido(cnpj))) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cpf_representante_ck') then
    alter table public.profiles add constraint profiles_cpf_representante_ck check (cpf_representante is null or (cpf_representante ~ '^\d{11}$' and public.cpf_valido(cpf_representante))) not valid;
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_cpf_unico') then
    create unique index profiles_cpf_unico on public.profiles (cpf) where cpf is not null;
  end if;
end;
$$;

-- Razão social deixa de ser editável direto pelo usuário (vai junto com o CNPJ, pelo servidor).
revoke update (company_name) on public.profiles from authenticated;

-- Campos protegidos: os mesmos da 0054 + CNPJ, razão social e CPF do representante.
create or replace function public.profiles_bloqueia_confianca()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- service_role (server actions) e papéis de migração podem tudo; usuário não.
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
     or new.cnpj                  is distinct from old.cnpj
     or new.company_name          is distinct from old.company_name
     or new.cpf_representante     is distinct from old.cpf_representante
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

revoke all on function public.cpf_valido(text) from public, anon;
revoke all on function public.cnpj_valido(text) from public, anon;
grant execute on function public.cpf_valido(text) to authenticated, service_role;
grant execute on function public.cnpj_valido(text) to authenticated, service_role;
