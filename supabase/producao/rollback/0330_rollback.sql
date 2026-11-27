-- Rollback da 0330 (E699, massa): volta a conta de teste proprietario-qa ao "sem CPF" (só se o CPF ainda for o de teste da 0330).
begin;
update public.profiles set cpf = null
 where lower(email) = 'proprietario-qa@mail-teste.com.br' and is_teste and cpf = '00000000272';
delete from supabase_migrations.schema_migrations where version = '20261107000330';
commit;
