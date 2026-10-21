-- 0199 — is_admin() passa a exigir verificação em duas etapas (aal2) quando o admin tem fator verificado (ordem b1583238, item 4).
-- Antes: bastava role = 'admin' (uma sessão só com senha, aal1, passava nas políticas RLS que usam is_admin()).
-- Agora: role = 'admin' E (sessão aal2 OU a conta ainda não tem fator verificado). Assim ninguém fica trancado para fora:
-- quem não ativou o 2FA continua entrando e o portão do /admin o leva a ativar. Sem dados pessoais. Idempotente.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
  and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
  );
$$;
