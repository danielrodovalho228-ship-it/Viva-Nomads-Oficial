-- Viva Nomads — rollback da 0227 (preferências por categoria e diagnóstico do push — 44-B2). Idempotente. Sem a coluna,
-- todo aviso volta a chegar (o padrão de antes); o cartão "Push" do admin fica sem a contagem de 7 dias.
begin;
set local lock_timeout = '5s';
drop table if exists public.push_envios;
alter table public.profiles drop constraint if exists profiles_notif_categorias_chk;
alter table public.profiles drop column if exists notif_categorias_desligadas;
delete from supabase_migrations.schema_migrations where version = '20261023000227';
commit;
