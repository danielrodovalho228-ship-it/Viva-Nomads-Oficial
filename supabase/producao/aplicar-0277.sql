-- Viva Nomads — aplicar 0277 (E399-B parte 1: selo "Preço justo" pelo total por mês e "≤"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0277_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  -- Só troca se a coluna ainda é a da 0130 (sem as contas); reaplicar não reescreve a tabela.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'properties' and column_name = 'preco_justo'
                and coalesce(generation_expression, '') not ilike '%condo_fee%') then
    alter table public.properties drop column preco_justo;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'properties' and column_name = 'preco_justo') then
    alter table public.properties
      add column preco_justo boolean generated always as (
        airbnb_monthly_price is not null
        and coalesce(monthly_price, 0) > 0
        and (
          coalesce(monthly_price, 0)
          + coalesce(condo_fee, 0)
          + case when utilities_mode = 'fixed' then coalesce(utilities_estimate, 0) else 0 end
          -- Limpeza durante a estadia (0144): só o valorMes numérico e na faixa que o site aceita (0 a 100.000).
          -- CASE dentro de CASE: o Postgres não garante a ordem do AND; assim o texto nunca vira número.
          + case when jsonb_typeof(limpeza_estadia -> 'valorMes') = 'number'
                 then case when (limpeza_estadia ->> 'valorMes')::numeric between 0 and 100000
                           then (limpeza_estadia ->> 'valorMes')::numeric else 0 end
                 else 0 end
        ) <= airbnb_monthly_price
      ) stored;
  end if;
end;
$$;

comment on column public.properties.preco_justo is
  'E399-B: selo "Preço justo" — total por mês (valor mensal + condomínio + contas fixas + limpeza) ≤ valor mensal que o dono declarou do Airbnb (airbnb_monthly_price).';

-- properties usa GRANT POR COLUNA (0053): a coluna recriada precisa do grant de novo, ou o selo some do site.
grant select (preco_justo) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261101000277', '0277_preco_justo_total', array['-- conteúdo em supabase/migrations/0277_preco_justo_total.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000277');
commit;
