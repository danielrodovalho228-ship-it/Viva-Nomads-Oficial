-- Viva Nomads — aplicar 0090 (documento da pessoa: CPF/CNPJ). APLICADA em 08/10/2026 (autorizada pelo Daniel).
-- Rollback: supabase/producao/rollback/0090_rollback.sql
-- Só acrescenta (coluna, funções, restrições NOT VALID, índice único) e reforça o
-- gatilho de campos protegidos. Sem DROP, sem NOTICE. Pode rodar no SQL Editor.
-- Antes: em 07/10/2026 nenhuma das 9 contas tinha CPF/CNPJ (nada a validar).
begin;
set local lock_timeout = '5s';
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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000090', '0090_documento_pessoa',
       array['-- conteúdo em supabase/migrations/0090_documento_pessoa.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000090');
commit;

-- Conferência (só leitura):
-- select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='cpf_representante';
-- select conname from pg_constraint where conname like 'profiles_%_ck' and conname in ('profiles_cpf_valido_ck','profiles_cnpj_valido_ck','profiles_cpf_representante_ck');
-- select public.cpf_valido('52998224725') as deve_ser_true, public.cpf_valido('52998224726') as deve_ser_false;
