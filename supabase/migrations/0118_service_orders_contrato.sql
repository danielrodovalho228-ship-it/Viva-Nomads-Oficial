-- F27 parte 2 (ordem a8905671): a ordem de manutenção fica vinculada ao contrato (tabela contratos).
-- service_orders.contract_id aponta para a tabela antiga "contracts"; por isso a coluna nova.
alter table public.service_orders
  add column if not exists contrato_id uuid references public.contratos (id) on delete set null;
create index if not exists service_orders_contrato_idx on public.service_orders (contrato_id);

-- Backfill: só quando existe UM único contrato do mesmo imóvel e inquilino (sem chute).
update public.service_orders so
   set contrato_id = u.id
  from (
    select property_id, tenant_id, (array_agg(id))[1] as id
      from public.contratos
     group by property_id, tenant_id
    having count(*) = 1
  ) u
 where so.contrato_id is null and so.property_id = u.property_id and so.tenant_id = u.tenant_id;
