-- ROLLBACK da 0073 (atendimento). Apaga chamados, mensagens e eventos — exporte antes.
begin;
do $c$ begin
  perform cron.unschedule('atendimento-prazos') where exists (select 1 from cron.job where jobname = 'atendimento-prazos');
exception when others then null; end $c$;
drop function if exists public.atendimento_tique();
drop function if exists public.atendimento_varrer_prazos();
drop function if exists public.admin_atendimento_metricas(int);
drop table if exists public.chamado_eventos;
drop table if exists public.chamado_mensagens;
drop table if exists public.chamado_macros;
drop table if exists public.chamados;
drop sequence if exists public.chamados_numero_seq;
commit;
