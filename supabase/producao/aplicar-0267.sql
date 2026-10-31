-- Aplicar 0267_qa_tipo_entrada_0264 (idempotente: só grava onde o campo ainda falta).
begin;
set local lock_timeout = '5s';

update public.properties p
   set draft_data = coalesce(p.draft_data, '{}'::jsonb) || jsonb_build_object('tipoEntrada', 'porteiro')
 where p.id in ('a0264a00-0000-4000-8000-000000000001', 'a0264b00-0000-4000-8000-000000000001')
   and p.status::text = 'draft'
   and not coalesce(p.draft_data ? 'tipoEntrada', false)
   and exists (select 1 from public.profiles d where d.id = p.owner_id and d.is_teste);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261031000267', '0267_qa_tipo_entrada_0264', array['-- conteúdo em supabase/migrations/0267_qa_tipo_entrada_0264.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261031000267');
commit;
