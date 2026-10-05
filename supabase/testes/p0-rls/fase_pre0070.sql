-- Antes da 0070: rotinas, gatilhos e a visão de métricas abertos à API.
reset role;
-- Estado de produção que o harness mínimo não tem (0006/0027).
alter table public.service_orders add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz;
do $$ begin
  if to_regprocedure('public.expira_pedidos_moradia()') is null then
    create function public.expira_pedidos_moradia() returns void language plpgsql security definer set search_path = public as $f$
    begin update pedidos_moradia set status = 'expirado' where status = 'ativo' and expira_em <= now(); end $f$;
  end if;
end $$;
create or replace view public.owner_response_metrics as
  select owner_id,
         avg(extract(epoch from first_response_at - opened_at) / 3600) filter (where first_response_at is not null) as avg_first_response_hours,
         avg(extract(epoch from resolved_at - opened_at) / 3600) filter (where resolved_at is not null) as avg_resolution_hours
    from public.service_orders group by owner_id;
grant all on public.owner_response_metrics to anon, authenticated;
grant execute on function public.avancar_ciclo_blocos(), public.expira_pedidos_moradia(), public.set_pedido_expira_em(),
  public.handle_new_user(), public.trg_recalc_listing_quality(), public.recalc_listing_quality(uuid) to anon, authenticated;
insert into public.service_orders (property_id, tenant_id, owner_id, description, opened_at, first_response_at)
  values ('aaaaaaa1-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
          'torneira', now() - interval '5 hours', now() - interval '3 hours');
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ANTES@0070','anônimo roda o ciclo dos contratos','passa',$q$select public.avancar_ciclo_blocos()$q$);
select t('ANTES@0070','anônimo lê o tempo de resposta de todos os donos','passa',$q$select count(*) from public.owner_response_metrics$q$);
reset role;
