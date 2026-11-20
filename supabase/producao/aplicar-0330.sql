-- Viva Nomads — aplicar 0330 (QA: CPF de teste na dona proprietario-qa, sem laudo = identidade pendente, para fechar o E699 (a)/(c)). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0330_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dona uuid;
  c_cpf constant text := '00000000272';
begin
  select id into v_dona from public.profiles where lower(email) = 'proprietario-qa@mail-teste.com.br' and is_teste;
  if v_dona is null then
    raise notice '0330: conta de teste proprietario-qa ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.profiles where cpf = c_cpf and id <> v_dona) then
    raise notice '0330: o CPF de teste já está em outra conta; nada a fazer';
    return;
  end if;
  update public.profiles set cpf = c_cpf where id = v_dona and cpf is null and cnpj is null and coalesce(person_type, 'pf') = 'pf';
  if found then
    raise notice '0330: CPF de teste gravado na conta de teste proprietario-qa (sem laudo: identidade pendente)';
  else
    raise notice '0330: a conta proprietario-qa já tem documento (ou é PJ); nada a fazer';
  end if;
end
$$;

insert into supabase_migrations.schema_migrations (version, name)
select '20261107000330', '0330_qa_identidade_pendente_e699'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000330');

commit;
