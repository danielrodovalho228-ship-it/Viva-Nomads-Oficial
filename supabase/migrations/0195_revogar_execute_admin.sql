-- 0195 — Funções SECURITY DEFINER só de admin: tira o EXECUTE de authenticated (ordem c9f6d762).
-- Todos os chamadores usam o cliente de serviço (service_role), depois de ehAdmin no servidor. Sem dados pessoais. Idempotente.

revoke all on function public.admin_financeiro(date, date, text) from public, anon, authenticated;
grant execute on function public.admin_financeiro(date, date, text) to service_role;
revoke all on function public.admin_financeiro_recorte(date, date, text, text) from public, anon, authenticated;
grant execute on function public.admin_financeiro_recorte(date, date, text, text) to service_role;
revoke all on function public.admin_visao_geral(date, date, text) from public, anon, authenticated;
grant execute on function public.admin_visao_geral(date, date, text) to service_role;
revoke all on function public.admin_atendimento_metricas(integer) from public, anon, authenticated;
grant execute on function public.admin_atendimento_metricas(integer) to service_role;
revoke all on function public.marcar_fundador(uuid) from public, anon, authenticated;
grant execute on function public.marcar_fundador(uuid) to service_role;
