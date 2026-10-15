-- 0133 — perfil_publico_dono: execute só para o servidor (achado do Moacir no #559).
-- A função é SECURITY DEFINER (lê profiles além da RLS); com execute para anon, qualquer um
-- poderia chamá-la direto na API do banco. Agora só o service_role executa; o servidor Next
-- (enrichProperty) chama pelo cliente admin. Nenhum dado é apagado.
revoke all on function public.perfil_publico_dono(uuid) from public, anon, authenticated;
grant execute on function public.perfil_publico_dono(uuid) to service_role;
