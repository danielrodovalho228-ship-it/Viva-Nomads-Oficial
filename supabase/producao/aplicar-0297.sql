-- Viva Nomads — aplicar 0297 (QA, E562: CPF de TESTE 000.000.001-91 na conta de teste do Paulo, proprietario2@). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Só a conta is_teste. Rollback: supabase/producao/rollback/0297_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_paulo uuid;
  c_cpf constant text := '00000000191'; -- CPF de teste (000.000.001-91): dígitos verificadores válidos
begin
  select id into v_paulo from public.profiles where lower(email) = 'proprietario2@vivanomads.com.br' and is_teste;
  if v_paulo is null then
    raise notice '0297: conta de teste do Paulo ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.profiles where cpf = c_cpf and id <> v_paulo) then
    raise notice '0297: o CPF de teste já está em outra conta; nada a fazer';
    return;
  end if;
  update public.profiles set cpf = c_cpf where id = v_paulo and cpf is null and cnpj is null and coalesce(person_type, 'pf') = 'pf';
  if found then
    raise notice '0297: CPF de teste gravado na conta de teste do Paulo (proprietario2@)';
  else
    raise notice '0297: a conta do Paulo já tem documento (ou é PJ); nada a fazer';
  end if;
end
$$;

-- Conferência (somente leitura):
--   select email, cpf, person_type from public.profiles where lower(email) = 'proprietario2@vivanomads.com.br';  -- 00000000191, pf

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000297', '0297_qa_cpf_teste_proprietario2_e562', array['-- conteúdo em supabase/migrations/0297_qa_cpf_teste_proprietario2_e562.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000297');
commit;
