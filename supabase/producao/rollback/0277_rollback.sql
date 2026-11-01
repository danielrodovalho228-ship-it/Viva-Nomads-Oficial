-- Rollback da 0277 (E399-B): volta a coluna gerada da 0130 (valor mensal SEM as contas, "<"). Nada mais é tocado.
begin;
set local lock_timeout = '5s';
alter table public.properties drop column if exists preco_justo;
alter table public.properties
  add column preco_justo boolean generated always as
    (airbnb_monthly_price is not null and monthly_price < airbnb_monthly_price) stored;
grant select (preco_justo) on public.properties to anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261101000277';
commit;
