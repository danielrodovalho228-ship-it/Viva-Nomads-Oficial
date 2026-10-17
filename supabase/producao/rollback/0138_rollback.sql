-- Rollback da 0138: devolve ao anon o SELECT que o Supabase dá por padrão (a RLS continua barrando).
begin;
grant select on public.emails_teste to anon;
delete from supabase_migrations.schema_migrations where version = '20261016000138';
commit;
