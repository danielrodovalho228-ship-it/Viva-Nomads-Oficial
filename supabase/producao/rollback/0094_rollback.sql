-- Rollback da 0094: remove o trigger, a função e a fila de avisos (só e-mails internos, sem dado de cliente).
-- Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
drop trigger if exists avisos_daniel_da_ronda on public.agentes_rondas;
drop function if exists public.avisos_daniel_da_ronda();
drop table if exists public.avisos_daniel;
delete from supabase_migrations.schema_migrations where version = '20261008000094';
commit;
