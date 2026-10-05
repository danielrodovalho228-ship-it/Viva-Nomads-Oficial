-- ─────────────────────────────────────────────────────────────────────────────
-- 0068 — CORREÇÃO DE SEGURANÇA: marcar_fundador liberava qualquer usuário.
--
-- A 0063 checava `current_user in ('service_role','postgres')`, mas a função é
-- SECURITY DEFINER: lá dentro current_user é o DONO da função (postgres), então
-- a checagem passava SEMPRE — qualquer conta logada marcava qualquer
-- proprietário como Fundador (até as 20 vagas). Em produção: 0 Fundadores,
-- nada a desfazer.
--
-- Agora o "quem chamou" vem do papel da requisição (current_setting('role')),
-- que o SECURITY DEFINER não troca: admin (is_admin), o servidor
-- (service_role) ou o SQL Editor (sessão direta do postgres, sem SET ROLE).
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.marcar_fundador(alvo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  papel text := coalesce(current_setting('role', true), 'none');
begin
  if not (
    public.is_admin()
    or papel = 'service_role'
    or (papel = 'none' and session_user in ('postgres', 'supabase_admin'))
  ) then
    raise exception 'Só a equipe marca Fundador.' using errcode = '42501';
  end if;
  update public.profiles set fundador = true where id = alvo and role = 'owner';
  if not found then
    raise exception 'Proprietário não encontrado.' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.marcar_fundador(uuid) from public, anon;
grant execute on function public.marcar_fundador(uuid) to authenticated, service_role;

-- Conferência (rodar depois):
--   select position('current_user' in pg_get_functiondef('public.marcar_fundador(uuid)'::regprocedure)) = 0; -- true
