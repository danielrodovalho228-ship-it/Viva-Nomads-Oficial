-- 0297 — E562 (só a massa): CPF de TESTE na conta de teste do Paulo (proprietario2@), para a reprova final do E562
-- exercitar o portão do E569/E582 até o fim — com CPF, "Enviar proposta" conclui. Os trabalhadores de QA não inventam
-- documento; a fixture grava um número de teste que passa nos dígitos verificadores (cpf_valido, o mesmo do app):
-- 000.000.001-91. Só a conta is_teste, só se ela ainda não tem CPF nem CNPJ e é pessoa física; não sobrescreve nada;
-- se o número já estiver em outra conta, não faz nada. Não toca anúncio, interessados, propostas, a seed do D-5 nem
-- chaves. Idempotente. Desfazer (volta ao "sem CPF"): supabase/producao/rollback/0297_rollback.sql.
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
