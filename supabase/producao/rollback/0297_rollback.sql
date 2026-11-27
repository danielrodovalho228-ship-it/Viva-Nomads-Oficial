-- Rollback da 0297 (E562): a conta de teste do Paulo volta a "sem CPF" — só se o CPF dela ainda for o de teste.
-- Serve também para repetir o lado "sem CPF" da prova (a mensagem no envio) depois da 0297.
begin;
set local lock_timeout = '5s';
update public.profiles set cpf = null where lower(email) = 'proprietario2@vivanomads.com.br' and is_teste and cpf = '00000000191';
delete from supabase_migrations.schema_migrations where version = '20261105000297';
commit;
