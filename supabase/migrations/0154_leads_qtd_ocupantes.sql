-- 0154: quantas pessoas vão morar (prompt 8). Informado pelo inquilino na candidatura; o servidor confere com a
-- capacidade do imóvel. O proprietário vê no cartão do candidato e o Fechamento abre com o número.
-- Como inicio_desejado e motivo_estadia, a coluna NÃO entra no SELECT por coluna de leads (0062): só o servidor lê.
alter table public.leads add column if not exists qtd_ocupantes smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_qtd_ocupantes_chk') then
    alter table public.leads add constraint leads_qtd_ocupantes_chk check (qtd_ocupantes is null or qtd_ocupantes between 1 and 20);
  end if;
end $$;
comment on column public.leads.qtd_ocupantes is 'Quantas pessoas vão morar, informado na candidatura (1 a 20, até a capacidade do imóvel). Opcional.';
