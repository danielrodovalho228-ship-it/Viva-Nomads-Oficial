-- Laboratório (nunca em produção): prova da 0199 — is_admin() e aal2. Tudo em begin/rollback.
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0199-is-admin-aal2.sql
begin;
create temp table adm as select id from profiles where role = 'admin' limit 1;
grant select on adm to authenticated;
select set_config('request.jwt.claim.sub', (select id::text from adm), true);

-- 1) admin sem fator verificado: continua admin (não tranca ninguém)
delete from auth.mfa_factors where user_id = (select id from adm);
select 'sem fator = admin' as caso, public.is_admin() as ok;

-- 2) admin com fator verificado e sessão aal1: NÃO é admin
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
  select gen_random_uuid(), id, 'totp', 'verified', now(), now() from adm;
select set_config('request.jwt.claims', '{"aal":"aal1"}', true);
select 'fator + aal1 = não admin' as caso, not public.is_admin() as ok;

-- 3) admin com fator verificado e sessão aal2: é admin
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
select 'fator + aal2 = admin' as caso, public.is_admin() as ok;

-- 4) quem não é admin nunca passa
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select 'desconhecido = não admin' as caso, not public.is_admin() as ok;
rollback;
