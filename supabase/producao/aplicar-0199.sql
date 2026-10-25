-- Viva Nomads — aplicar 0199 (is_admin exige aal2 quando há fator verificado). Idempotente. Rollback: supabase/producao/rollback/0199_rollback.sql.
begin;
set local lock_timeout = '5s';
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
  and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
  );
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261021000199', '0199_is_admin_aal2',
       array['-- conteúdo em supabase/migrations/0199_is_admin_aal2.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261021000199');
commit;
