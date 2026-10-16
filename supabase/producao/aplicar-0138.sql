-- Viva Nomads — aplicar 0138 (emails_teste sem privilégio do anônimo). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0138_rollback.sql.
begin;
set local lock_timeout = '5s';

-- A RLS da 0136 já barra a leitura (só admin lê); aqui sai também o privilégio de tabela do anon.
revoke all on public.emails_teste from anon;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000138', '0138_emails_teste_sem_anon',
       array['-- conteúdo em supabase/migrations/0138_emails_teste_sem_anon.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000138');
commit;
