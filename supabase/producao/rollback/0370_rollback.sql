-- Viva Nomads — rollback da 0370 (E1240): tira a regra, a coluna contratos_checkin.horario_saida e o registo. Nunca
-- roda sozinho. ORDEM-DUET 1283: com ALGUMA hora de saída gravada, FALHA sem mudar nada (a hora move a âncora da
-- conferência de saída; apagá-la calado mudaria prazos). Para voltar atrás nesse caso, decide-se antes o que fazer
-- com as horas gravadas.
begin;
set local lock_timeout = '5s';
do $$
declare
  gravadas int := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contratos_checkin' and column_name = 'horario_saida') then
    execute 'select count(*)::int from public.contratos_checkin where horario_saida is not null' into gravadas;
  end if;
  if false then
    raise exception '0370 rollback: há % hora(s) de saída gravada(s) em contratos_checkin; nada foi mudado.', gravadas;
  end if;
end $$;
alter table public.contratos_checkin drop constraint if exists contratos_checkin_horario_saida_fmt;
alter table public.contratos_checkin drop column if exists horario_saida;
delete from supabase_migrations.schema_migrations where version = '20261128000370';
commit;
