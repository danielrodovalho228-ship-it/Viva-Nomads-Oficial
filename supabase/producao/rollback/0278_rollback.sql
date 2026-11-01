-- Rollback da 0278 (E399-B): tira, POR ID, o valor do Airbnb declarado nos dois anúncios de teste. Nada mais é tocado.
begin;
set local lock_timeout = '5s';
update public.properties set airbnb_monthly_price = null
 where id in ('a0263000-0000-4000-8000-000000000001', 'a0263000-0000-4000-8000-000000000002') and title like '[TESTE QA] Proativo E264 %';
delete from supabase_migrations.schema_migrations where version = '20261101000278';
commit;
