-- Rollback da 0271: sai a visita de avaliação de teste (pelo id fixo); designações, conduta e auditoria dela saem em
-- cascata. O anúncio de teste fica como estava (pausado).
begin;
set local lock_timeout = '5s';
delete from public.vistoria_pedidos where id = 'a0271000-0000-4000-8000-000000000001';
delete from supabase_migrations.schema_migrations where version = '20261031000271';
commit;
