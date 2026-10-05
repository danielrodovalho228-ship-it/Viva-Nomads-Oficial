-- ROLLBACK da 0069 (visão geral do /admin). A tela volta a mostrar "—".
begin;
drop function if exists public.admin_visao_geral(date, date, text);
drop function if exists public.admin_metricas_periodo(timestamptz, timestamptz, text);
commit;
