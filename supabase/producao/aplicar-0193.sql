-- Viva Nomads — aplicar 0193 (contas de QA marcadas como teste, Prompt 36). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0193_rollback.sql.
begin;
set local lock_timeout = '5s';

-- Cinco contas de QA ainda estavam como reais (a 0135 marcou só proprietario1, inquilino1, teste-qa e o laboratório).
-- O aviso mostra só a QUANTIDADE de contas marcadas (esperado: 5 na primeira vez, 0 ao reaplicar); nunca e-mail.
do $$
declare
  v_qtd integer;
begin
  update public.profiles
     set is_teste = true
   where not is_teste
     and lower(split_part(email, '@', 1)) in ('proprietario2', 'proprietario3cnpj', 'inquilino2', 'proprietario-qa', 'teste-qa-2026');
  get diagnostics v_qtd = row_count;
  raise notice '0193: % conta(s) de QA marcada(s) como teste', v_qtd;
end;
$$;

-- Conferência (somente leitura):
--   select count(*) from public.profiles where is_teste
--     and lower(split_part(email, '@', 1)) in ('proprietario2', 'proprietario3cnpj', 'inquilino2', 'proprietario-qa', 'teste-qa-2026');  -- 5

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000193', '0193_contas_qa_teste',
       array['-- conteúdo em supabase/migrations/0193_contas_qa_teste.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000193');
commit;
