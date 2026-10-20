-- Rollback da 0177: devolve o SELECT de antes (contratos inteiro para authenticated e anon; nas leads, a taxa e o plano).
begin;
grant select on public.contratos to authenticated, anon;
grant select (accepted_commission_rate, accepted_plan) on public.leads to authenticated;
delete from supabase_migrations.schema_migrations where version = '20261019000177';
commit;
