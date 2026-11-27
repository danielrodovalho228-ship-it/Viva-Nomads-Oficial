-- 0290 — E256-B: a porta de QA (/qa/entrar) recusava a conta de TESTE proprietario1 com o motivo "2fa" por causa de um
-- fator TOTP legado (iniciado em 03/11 e nunca confirmado). Remove o fator SÓ dessa conta de teste, como a 0257 fez com
-- as demais. Não toca nenhuma conta real, o admin observador (qa_admin), o 2FA do admin do Daniel nem a válvula
-- ADMIN_2FA_OBRIGATORIA. Idempotente. Desfazer: supabase/producao/rollback/0290_rollback.sql.
do $$
declare
  v_conta uuid;
  v_n int;
begin
  -- SÓ a conta de TESTE proprietario1 (e-mail exato, is_teste, não é o admin observador). Em qualquer outra base, nada.
  select id into v_conta from public.profiles
   where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste = true and coalesce(qa_admin, false) = false;
  if v_conta is null then
    raise notice '0290: conta de teste proprietario1 ausente, não marcada como teste ou admin observador; nada a fazer';
    return;
  end if;
  -- O fator 2FA legado (TOTP iniciado e nunca confirmado) fazia a porta de QA recusar a conta com o motivo "2fa".
  -- Conta de teste da porta não tem 2FA (docs/qa-login.md, 0257). Os desafios do fator caem junto (cascata do Auth).
  delete from auth.mfa_factors where user_id = v_conta;
  get diagnostics v_n = row_count;
  raise notice '0290: % fator(es) removido(s) da conta de teste proprietario1', v_n;
end
$$;
