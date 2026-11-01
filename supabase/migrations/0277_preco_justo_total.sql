-- 0277 — E399-B parte 1: o selo "Preço justo" compara o TOTAL POR MÊS com o valor declarado do Airbnb. Idempotente.
-- Bug: a coluna gerada da 0130 comparava o valor mensal SEM as contas (monthly_price) com o total que o dono declara
-- do Airbnb (que já inclui tudo): um imóvel com contas à parte ganhava o selo saindo MAIS CARO para o morador.
-- Agora: total por mês = valor mensal + condomínio + contas fixas + limpeza durante a estadia (a MESMA conta do cartão,
-- calcularTudoIncluido em src/lib/precos.ts) e o critério "não maior" (≤), combinado pelo Daniel com o Rogério.
-- Sem o valor do Airbnb (campo opcional, declarado pelo dono; a Viva não lê o Airbnb), não há selo.
-- Produção em 01/11: nenhum anúncio informa o valor do Airbnb — nenhum selo muda hoje.
-- Rollback: supabase/producao/rollback/0277_rollback.sql (volta a regra da 0130).

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
