-- Rollback da 0257: as 5 contas da equipe voltam a is_teste = false (e-mail exato). O fator 2FA removido NÃO volta:
-- o segredo TOTP não fica guardado em lugar nenhum; quem quiser 2FA de novo cadastra um fator novo na tela.
begin;
set local lock_timeout = '5s';
update public.profiles set is_teste = false
 where lower(email) = any (array[
   'avaliador1@vivanomads.com.br', 'cadastro1@vivanomads.com.br', 'cadastro2@vivanomads.com.br',
   'cadastro3@vivanomads.com.br', 'cadastro-teste-2310@vivanomads.com.br'
 ]);
delete from supabase_migrations.schema_migrations where version = '20261030000257';
commit;
