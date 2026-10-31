-- Rollback da 0267: tira draft_data.tipoEntrada dos dois rascunhos de QA da 0264 (se ainda forem rascunho de teste).
begin;
set local lock_timeout = '5s';
update public.properties p
   set draft_data = p.draft_data - 'tipoEntrada'
 where p.id in ('a0264a00-0000-4000-8000-000000000001', 'a0264b00-0000-4000-8000-000000000001')
   and p.status::text = 'draft'
   and exists (select 1 from public.profiles d where d.id = p.owner_id and d.is_teste);
delete from supabase_migrations.schema_migrations where version = '20261031000267';
commit;
