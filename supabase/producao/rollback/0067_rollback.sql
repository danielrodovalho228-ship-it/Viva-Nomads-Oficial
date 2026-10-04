-- ROLLBACK da 0067 (eventos + gastos de marketing). O /api/evento passa a
-- devolver 204 sem gravar (a tabela some); a tela de marketing fica sem dados.
begin;
do $cron$
begin
  perform cron.unschedule('limpar-eventos-antigos')
    where exists (select 1 from cron.job where jobname = 'limpar-eventos-antigos');
exception when others then null;
end $cron$;
drop function if exists public.limpar_eventos_antigos();
drop table if exists public.eventos;
drop table if exists public.gastos_marketing;
commit;
