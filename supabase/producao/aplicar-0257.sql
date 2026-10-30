-- Viva Nomads — aplicar 0257 (E256-B: contas de teste da equipe marcadas e sem 2FA, fora o admin observador). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0257_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  -- As 5 contas da equipe que a porta de QA precisa e que estavam com is_teste = false. E-mail EXATO, nenhuma outra.
  c_emails constant text[] := array[
    'avaliador1@vivanomads.com.br', 'cadastro1@vivanomads.com.br', 'cadastro2@vivanomads.com.br',
    'cadastro3@vivanomads.com.br', 'cadastro-teste-2310@vivanomads.com.br'
  ];
  v_ids uuid[];
  v_motivo text;
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.profiles where lower(email) = any (c_emails);

  -- Trava: nenhuma delas pode ter vida real na plataforma. Imóvel ATIVO que não é anúncio de teste, ou contrato com
  -- uma conta real do outro lado (como morador ou como dono) → aborta com a mensagem e nada muda.
  select string_agg(distinct m, '; ') into v_motivo from (
    select 'dona de imóvel ativo real (' || p.id || ')' as m
      from public.properties p
     where p.owner_id = any (v_ids) and p.status::text = 'active' and p.title !~* '^\s*\[\s*(teste|test|qa)\y'
    union all
    select 'morador de contrato com dono real (' || k.id || ')'
      from public.contratos k join public.properties p on p.id = k.property_id
      join public.profiles d on d.id = p.owner_id
     where k.tenant_id = any (v_ids) and coalesce(d.is_teste, false) = false and not (d.id = any (v_ids))
    union all
    select 'dona de contrato com morador real (' || k.id || ')'
      from public.contratos k join public.properties p on p.id = k.property_id
      join public.profiles t on t.id = k.tenant_id
     where p.owner_id = any (v_ids) and coalesce(t.is_teste, false) = false and not (t.id = any (v_ids))
  ) x;
  if v_motivo is not null then
    raise exception '0257: uma das contas tem vínculo com conta real; nada foi marcado. %', v_motivo;
  end if;

  update public.profiles set is_teste = true where lower(email) = any (c_emails) and is_teste is distinct from true;

  -- Conta de teste usada pela porta não tem 2FA (docs/qa-login.md). Sai o fator de toda conta is_teste que NÃO é o
  -- admin observador (qa_admin): o fator da qa-muse-1 fica. Os desafios do fator caem junto (cascata do Auth).
  delete from auth.mfa_factors f
   using public.profiles p
   where p.id = f.user_id and p.is_teste = true and coalesce(p.qa_admin, false) = false;
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000257', '0257_qa_contas_teste_sem_2fa', array['-- conteúdo em supabase/migrations/0257_qa_contas_teste_sem_2fa.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000257');
commit;
