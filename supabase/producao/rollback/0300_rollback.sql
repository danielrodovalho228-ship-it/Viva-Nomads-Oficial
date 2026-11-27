-- Rollback da 0300 (E509): o gatilho de coerência da pausa volta a rodar só no UPDATE (como na 0223). O motivo 'dono'
-- dado aos 3 anúncios da massa do E289 fica (é o motivo coerente; voltar a null recriaria o defeito).
begin;
drop trigger if exists trg_properties_pausa_coerente on public.properties;
create trigger trg_properties_pausa_coerente before update of status on public.properties
  for each row execute function public.properties_pausa_coerente();
delete from supabase_migrations.schema_migrations where version = '20261105000300';
commit;
