-- 0130 — PREÇO JUSTO (ordem 4c74ac38, item 2). Idempotente.
--   • properties.airbnb_monthly_price: equivalente mensal que o dono tem no Airbnb (opcional, > 0);
--   • properties.preco_justo: calculada (aluguel mensal < Airbnb informado) — alimenta o selo e o pequeno
--     impulso na busca. Sem o campo, false. Leitura pública (é só o preço que o dono já anuncia).
-- Rollback: supabase/producao/rollback/0130_rollback.sql.
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
