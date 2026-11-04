-- Rollback da 0290: o fator 2FA removido NÃO volta — o segredo TOTP não fica guardado em lugar nenhum, e o fator nunca
-- tinha sido confirmado (não protegia nada). Quem quiser 2FA na conta de teste cadastra um fator novo na tela.
-- Só tira o registro da migração.
begin;
set local lock_timeout = '5s';
delete from supabase_migrations.schema_migrations where version = '20261104000290';
commit;
