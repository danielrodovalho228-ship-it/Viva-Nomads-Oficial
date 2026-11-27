-- 0330 — QA (E699, só a massa): conta de teste DONA com CPF e SEM laudo de identidade = identidade PENDENTE.
--
-- O E699 segue parcial porque nenhuma conta de teste provada tinha identidade pendente: as donas com laudo válido
-- (proprietario1, proprietario2) mostram "ok", e as donas sem laudo (proprietario3cnpj, proprietario-qa) estavam SEM CPF
-- (estado "sem_cpf": o link leva a "Conta › Dados", não a "Confirmar identidade"). Para provar o ramo "pendente" (a
-- "Falta para publicar" do painel e o link "Resolver" da trava de identidade, que leva a /dashboard/verificacao) falta
-- uma dona de teste COM CPF e SEM laudo. Esta migração grava um CPF de teste na conta proprietario-qa@mail-teste.com.br,
-- que tem 1 rascunho e nenhum laudo. NÃO cria laudo, NÃO confirma identidade, não toca anúncio, chave nem outra conta.
-- CPF de teste 000.000.002-72 (dígitos verificadores válidos, o mesmo critério do banco, cpf_valido; o 000.000.001-91 é do Paulo, 0297).
-- Só conta is_teste, só se ainda não tem CPF nem CNPJ e é pessoa física; se o número estiver em outra conta, não faz nada. Idempotente.
-- Desfazer (volta ao "sem CPF"): supabase/producao/rollback/0330_rollback.sql.
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
