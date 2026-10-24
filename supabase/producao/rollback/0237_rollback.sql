-- Viva Nomads — rollback da 0237: tira profiles.data_nascimento (as datas voltam para user_metadata). Idempotente.
-- As datas voltam para user_metadata.data_nascimento, onde a tela as guardava antes da 0237.
begin;
set local lock_timeout = '5s';
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'data_nascimento') then
    update auth.users u
       set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('data_nascimento', p.data_nascimento::text)
      from public.profiles p
     where p.id = u.id and p.data_nascimento is not null;
  end if;
end $$;
alter table public.profiles drop column if exists data_nascimento;
delete from supabase_migrations.schema_migrations where version = '20261024000237';
commit;
