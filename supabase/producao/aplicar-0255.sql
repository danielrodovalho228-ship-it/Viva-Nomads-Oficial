-- Viva Nomads — aplicar 0255 (E237: o bucket central-anexos sai, só se estiver vazio). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0255_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  n bigint;
  p record;
begin
  if not exists (select 1 from storage.buckets where id = 'central-anexos') then
    return;
  end if;
  select count(*) into n from storage.objects where bucket_id = 'central-anexos';
  if n > 0 then
    raise exception '0255: o bucket central-anexos tem % objeto(s); nada foi apagado. Decida o destino dos arquivos antes de reaplicar.', n;
  end if;
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'storage' and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%central-anexos%'
  loop
    execute format('drop policy if exists %I on storage.%I', p.policyname, p.tablename);
  end loop;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'central-anexos';
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261029000255', '0255_central_anexos_sai', array['-- conteúdo em supabase/migrations/0255_central_anexos_sai.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261029000255');
commit;
