-- ROLLBACK da 0070. Devolve o acesso que existia (NÃO recomendado: reabre os
-- avisos). O código novo chama as rotinas pelo servidor, então funciona igual.
begin;
grant execute on function public.avancar_ciclo_blocos(), public.expira_pedidos_moradia() to anon, authenticated;
alter view public.owner_response_metrics reset (security_invoker);
grant select on public.owner_response_metrics to anon;
commit;
