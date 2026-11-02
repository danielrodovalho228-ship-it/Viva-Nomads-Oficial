-- Viva Nomads — aplicar 0284 (E435: caixa de teste com HTML, destinatário e link de descadastro). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0284_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.emails_teste add column if not exists html text;
alter table public.emails_teste add column if not exists destinatario text;
alter table public.emails_teste add column if not exists descadastro_url text;

comment on column public.emails_teste.html is 'E435: versão HTML do e-mail de teste, sem links com token de acesso (E163).';
comment on column public.emails_teste.destinatario is 'E435: destinatário por extenso (só contas de teste), para o leitor de QA.';
comment on column public.emails_teste.descadastro_url is 'E435: link de descadastro com token (só contas de teste), para o leitor de QA.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261102000284', '0284_emails_teste_html_destinatario', array['-- conteúdo em supabase/migrations/0284_emails_teste_html_destinatario.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261102000284');
commit;
