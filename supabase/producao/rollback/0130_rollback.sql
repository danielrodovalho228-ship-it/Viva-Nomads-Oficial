-- Rollback da 0130: remove o preço do Airbnb informado e o selo calculado (o dado informado se perde).
begin;
alter table public.properties drop column if exists preco_justo;
alter table public.properties drop column if exists airbnb_monthly_price;
delete from supabase_migrations.schema_migrations where version = '20261015000130';
commit;
