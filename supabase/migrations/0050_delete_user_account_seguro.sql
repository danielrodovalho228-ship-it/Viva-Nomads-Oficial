-- ════════════════════════════════════════════════════════════════════════
-- Exclusão de conta DENTRO do app — segura contra perda de registro legal.
--
-- A `delete_user_account()` (0012) apagava `auth.users` em cascata, levando junto
-- contratos, blocos, pagamentos e vistorias. Isto a endurece, igualando o caminho
-- da página pública /excluir-conta:
--   • locação/contrato ATIVO → BLOQUEIA (raise 'LOCACAO_ATIVA'); encerre antes.
--   • HISTÓRICO de contratos → ANONIMIZA (anonimizar_conta, migração 0049),
--     mantendo os registros sem identificação pelo prazo legal.
--   • sem contratos → apaga de fato.
-- Retorna 'deleted' | 'anonymized' para o cliente saber o desfecho.
--
-- ⚠️ ADITIVA/idempotente, mas NÃO aplique sem revisão. Depende da 0049
--    (função anonimizar_conta) já aplicada. Aplique você.
-- ════════════════════════════════════════════════════════════════════════

-- Muda o tipo de retorno (void → text), então precisa DROP antes do CREATE.
drop function if exists public.delete_user_account();

create function public.delete_user_account()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  tem_ativo boolean;
  tem_historico boolean;
begin
  if uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Locação/contrato ATIVO (como inquilino OU dono) → bloqueia.
  select exists (
    select 1 from public.contratos c
    where c.status = 'ativo'
      and (
        c.tenant_id = uid
        or exists (select 1 from public.properties p where p.id = c.property_id and p.owner_id = uid)
      )
  ) into tem_ativo;

  if tem_ativo then
    raise exception 'LOCACAO_ATIVA' using errcode = 'P0001';
  end if;

  -- HISTÓRICO de contratos/locações (qualquer status, inquilino OU dono).
  select (
    exists (
      select 1 from public.contratos c
      where c.tenant_id = uid
        or exists (select 1 from public.properties p where p.id = c.property_id and p.owner_id = uid)
    )
    or exists (
      select 1 from public.locacoes l
      where l.tenant_id = uid
        or exists (select 1 from public.properties p where p.id = l.property_id and p.owner_id = uid)
    )
  ) into tem_historico;

  if tem_historico then
    perform public.anonimizar_conta(uid);  -- mantém os registros, sem identidade
    return 'anonymized';
  end if;

  -- Sem contratos: apaga de fato (auth.users → cascata).
  delete from auth.users where id = uid;
  return 'deleted';
end;
$$;

revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;
