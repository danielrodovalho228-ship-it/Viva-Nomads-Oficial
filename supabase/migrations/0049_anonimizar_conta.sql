-- ════════════════════════════════════════════════════════════════════════
-- Anonimização de conta (LGPD + retenção legal).
--
-- Excluir a conta em cascata apaga TAMBÉM contratos, blocos, pagamentos e
-- vistorias (FKs ON DELETE CASCADE). Quando a conta tem HISTÓRICO de contratos,
-- a lei pode exigir guardar esses registros por um prazo. Então, nesses casos,
-- em vez de apagar, ANONIMIZAMOS: removemos a identidade (nome, e-mail, telefone,
-- foto) e bloqueamos o login, mantendo os contratos/blocos/pagamentos SEM
-- identificação, pelo prazo legal.
--
-- ⚠️ Esta migração é ADITIVA e idempotente, mas NÃO deve ser aplicada sem revisão
--    (e sem confirmar o PRAZO legal de retenção com um advogado). Aplique você.
-- ════════════════════════════════════════════════════════════════════════

-- Marcador de conta anonimizada (também serve para esconder/bloquear na UI).
alter table public.profiles
  add column if not exists anonymized_at timestamptz;

-- Anonimiza o usuário `target`: limpa a identidade no perfil e no auth, bloqueia
-- o login e preserva os registros contratuais (que apontam por id, agora sem
-- identificação). SECURITY DEFINER para poder tocar em auth.users.
create or replace function public.anonimizar_conta(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if target is null then
    raise exception 'target nulo';
  end if;

  update public.profiles
     set full_name = null,
         email = null,
         phone = null,
         avatar_url = null,
         anonymized_at = now()
   where id = target;

  -- Remove a identidade no auth e bloqueia o acesso (sem apagar a linha, para
  -- não cascatear os contratos). E-mail trocado por um valor único e inválido.
  update auth.users
     set email = 'removido+' || target::text || '@anonimizado.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         banned_until = 'infinity'::timestamptz
   where id = target;
end;
$$;

-- Só o servidor (service role) chama — nunca anon/authenticated/public.
revoke all on function public.anonimizar_conta(uuid) from public, anon, authenticated;
grant execute on function public.anonimizar_conta(uuid) to service_role;
