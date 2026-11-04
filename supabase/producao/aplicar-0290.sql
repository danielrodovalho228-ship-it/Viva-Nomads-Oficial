-- Viva Nomads — aplicar 0290 (E256-B: conta de teste proprietario1 sem o fator 2FA legado). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0290_rollback.sql.
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261104000290', '0290_qa_proprietario1_sem_fator_legado', array['-- conteúdo em supabase/migrations/0290_qa_proprietario1_sem_fator_legado.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261104000290');
commit;
