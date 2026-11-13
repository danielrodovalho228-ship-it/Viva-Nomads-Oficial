-- Rollback da 0341: some as colunas da completude e das regressões (as contagens antigas da linha ficam intactas).
-- Antes de desfazer, volte o passo "Registrar no banco" do laboratorio.yml para o insert sem essas colunas.
begin;
alter table public.lab_execucoes drop column if exists regressoes;
alter table public.lab_execucoes drop column if exists nao_executados;
alter table public.lab_execucoes drop column if exists executados;
alter table public.lab_execucoes drop column if exists listados;
delete from supabase_migrations.schema_migrations where version = '20261111000341';
commit;
