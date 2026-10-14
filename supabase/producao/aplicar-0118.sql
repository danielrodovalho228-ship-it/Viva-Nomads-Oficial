-- Viva Nomads — aplicar 0118 (F27 parte 2: service_orders.contrato_id, ordem a8905671).
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0118_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.service_orders
  add column if not exists contrato_id uuid references public.contratos (id) on delete set null;
create index if not exists service_orders_contrato_idx on public.service_orders (contrato_id);

update public.service_orders so
   set contrato_id = u.id
  from (
    select property_id, tenant_id, (array_agg(id))[1] as id
      from public.contratos
     group by property_id, tenant_id
    having count(*) = 1
  ) u
 where so.contrato_id is null and so.property_id = u.property_id and so.tenant_id = u.tenant_id;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000118', '0118_service_orders_contrato',
       array['-- conteúdo em supabase/migrations/0118_service_orders_contrato.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000118');
commit;
