-- Rollback da 0170: devolve limpezas_max = 0 às linhas que a 0170 mudou (guardadas em _bkp_0170_limpezas_max).
begin;
insert into public.property_negociacao_limites (property_id, owner_id, limpezas_max)
select b.property_id, p.owner_id, b.limpezas_max
  from public._bkp_0170_limpezas_max b join public.properties p on p.id = b.property_id
on conflict (property_id) do update set limpezas_max = excluded.limpezas_max;
drop table if exists public._bkp_0170_limpezas_max;
delete from supabase_migrations.schema_migrations where version = '20261019000170';
commit;
