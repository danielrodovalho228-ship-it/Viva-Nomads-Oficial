-- Aplicar 0265_qa_zera_intencao_ana (idempotente: zerar de novo uma intenção já nula não muda nada).
begin;
set local lock_timeout = '5s';

update public.profiles
   set intencao = null
 where id = '3555816b-7100-4301-94a4-aec9eeccf991'
   and email = 'inquilino2@vivanomads.com.br'
   and is_teste is true;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000265', '0265_qa_zera_intencao_ana', array['-- conteúdo em supabase/migrations/0265_qa_zera_intencao_ana.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000265');
commit;
