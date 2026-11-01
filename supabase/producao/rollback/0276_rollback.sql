-- Rollback da 0276 (E375-B): tira, POR ID, a massa de QA do resumo semanal — as duas quedas, o favorito criado para a
-- inquilino2, as qualificações, as fotos e os dois anúncios "[TESTE QA] Resumo semanal 0276". Um resumo que já saiu
-- continua registrado na fila dos proativos (histórico). Nada mais é tocado.
begin;
set local lock_timeout = '5s';
delete from public.quedas_preco where id in ('a0276c00-0000-4000-8000-000000000001', 'a0276c00-0000-4000-8000-000000000002');
delete from public.favorites where id = 'a0276d00-0000-4000-8000-000000000002';
delete from public.qualification_checklists where id in ('a0276a00-0000-4000-8000-000000000011', 'a0276b00-0000-4000-8000-000000000011');
delete from public.property_photos where property_id in ('a0276a00-0000-4000-8000-000000000001', 'a0276b00-0000-4000-8000-000000000001');
delete from public.properties where id in ('a0276a00-0000-4000-8000-000000000001', 'a0276b00-0000-4000-8000-000000000001')
  and title like '[TESTE QA] Resumo semanal 0276 %';
delete from supabase_migrations.schema_migrations where version = '20261101000276';
commit;
