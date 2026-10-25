-- Rollback da 0193: desmarca só as cinco contas de QA que ela marcou. As da 0135 (inclusive as do laboratório,
-- @lab.vivanomads.test) continuam marcadas. Uma conta dessas cinco que o admin marcou pela tela também volta a real.
begin;
update public.profiles
   set is_teste = false
 where is_teste
   and lower(split_part(email, '@', 1)) in ('proprietario2', 'proprietario3cnpj', 'inquilino2', 'proprietario-qa', 'teste-qa-2026')
   and lower(email) not like '%@lab.vivanomads.test';
delete from supabase_migrations.schema_migrations where version = '20261019000193';
commit;
