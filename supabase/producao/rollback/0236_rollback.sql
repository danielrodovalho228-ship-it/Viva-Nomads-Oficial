-- Viva Nomads — rollback da 0236: tira a tabela recebimento_pix (a tela de Pagamentos volta a só explicar). Idempotente.
begin;
set local lock_timeout = '5s';
drop table if exists public.recebimento_pix;
delete from supabase_migrations.schema_migrations where version = '20261024000236';
commit;
