-- Viva Nomads — aplicar 0326 (E687: dados da categoria Mudança no parceiro). Idempotente. Rollback: supabase/producao/rollback/0326_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.parceiros
  add column if not exists dados_categoria jsonb not null default '{}'::jsonb;

update public.parceiros p
   set dados_categoria = s.dados_categoria
  from public.parceiro_solicitacoes s
 where s.id = p.solicitacao_id
   and p.dados_categoria = '{}'::jsonb
   and s.dados_categoria is not null
   and s.dados_categoria <> '{}'::jsonb;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000326', '0326_parceiro_dados_categoria_e687', array['-- conteúdo em supabase/migrations/0326_parceiro_dados_categoria_e687.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000326');

commit;
