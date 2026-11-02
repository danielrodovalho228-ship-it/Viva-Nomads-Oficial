-- Rollback da 0281 (E293): para a rotina diária e tira a função. O que já saiu não volta (está no livro eliminacoes_registro).
begin;
set local lock_timeout = '5s';
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('e293-limpeza-retencao') where exists (select 1 from cron.job where jobname = 'e293-limpeza-retencao');
  end if;
end;
$$;
drop function if exists public.e293_limpeza_retencao();
delete from supabase_migrations.schema_migrations where version = '20261101000281';
commit;
