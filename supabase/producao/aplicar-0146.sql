-- Viva Nomads — aplicar 0146 (messages sem recursão de política, corrige a 0145). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0146_rollback.sql.
begin;
set local lock_timeout = '5s';
alter policy "mensagens das partes" on public.messages
  using (sender_id = auth.uid() or receiver_id = auth.uid());

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000146', '0146_messages_sem_recursao',
       array['-- conteúdo em supabase/migrations/0146_messages_sem_recursao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000146');
commit;
