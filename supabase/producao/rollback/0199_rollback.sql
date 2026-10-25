-- Rollback da 0199: is_admin() volta a olhar só o papel (estado anterior).
begin;
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
  );
$$;
delete from supabase_migrations.schema_migrations where version = '20261021000199';
commit;
