-- Viva Nomads — rollback da 0229 (importar calendário — Prompt 53). Idempotente. Os bloqueios importados somem (são
-- cópia do outro site); os manuais do dono ficam. A política do dono volta a valer para todos os bloqueios.
begin;
set local lock_timeout = '5s';
do $cron$
begin
  perform cron.unschedule('calendario-importar') where exists (select 1 from cron.job where jobname = 'calendario-importar');
exception when others then
  raise notice 'pg_cron indisponível (%).', sqlerrm;
end $cron$;
drop function if exists public.calendario_importar_tique();
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'property_blocks' and column_name = 'origem') then
    delete from public.property_blocks where origem = 'importado';
  end if;
end $$;
drop policy if exists "blocks: dono gerencia" on public.property_blocks;
create policy "blocks: dono gerencia" on public.property_blocks
  for all
  using (exists (select 1 from public.properties p where p.id = property_blocks.property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_blocks.property_id and p.owner_id = auth.uid()));
alter table public.property_blocks drop constraint if exists property_blocks_origem_chk;
drop index if exists public.property_blocks_importacao;
alter table public.property_blocks drop column if exists importacao_id;
alter table public.property_blocks drop column if exists origem;
drop table if exists public.calendario_importacoes;
delete from supabase_migrations.schema_migrations where version = '20261023000229';
commit;
