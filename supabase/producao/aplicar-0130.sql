-- Viva Nomads — aplicar 0130 (preço justo: preço no Airbnb opcional + selo calculado). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0130_rollback.sql.
begin;
set local lock_timeout = '5s';
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'properties' and column_name = 'airbnb_monthly_price') then
    alter table public.properties
      add column airbnb_monthly_price numeric(10,2) check (airbnb_monthly_price is null or airbnb_monthly_price > 0);
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'properties' and column_name = 'preco_justo') then
    alter table public.properties
      add column preco_justo boolean generated always as
        (airbnb_monthly_price is not null and monthly_price < airbnb_monthly_price) stored;
  end if;
end;
$$;

-- properties usa GRANT POR COLUNA (0053): coluna nova sem grant some do site.
grant select (airbnb_monthly_price, preco_justo) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261015000130', '0130_preco_justo',
       array['-- conteúdo em supabase/migrations/0130_preco_justo.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261015000130');
commit;
