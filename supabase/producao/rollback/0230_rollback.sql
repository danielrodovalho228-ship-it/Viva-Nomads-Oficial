-- Viva Nomads — rollback da 0230 (respostas rápidas e mensagens programadas — Prompt 55-E2). Idempotente. As respostas
-- salvas e as mensagens ainda não enviadas somem; as já enviadas continuam na conversa (messages).
begin;
set local lock_timeout = '5s';
do $cron$
begin
  perform cron.unschedule('mensagens-programadas') where exists (select 1 from cron.job where jobname = 'mensagens-programadas');
exception when others then
  raise notice 'pg_cron indisponível (%).', sqlerrm;
end $cron$;
drop function if exists public.mensagens_programadas_tique();
drop table if exists public.mensagens_programadas;
drop trigger if exists respostas_rapidas_limite on public.respostas_rapidas;
drop table if exists public.respostas_rapidas;
drop function if exists public.respostas_rapidas_limite();
delete from supabase_migrations.schema_migrations where version = '20261023000230';
commit;
