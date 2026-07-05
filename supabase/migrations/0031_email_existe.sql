-- Orienta o acesso: distingue "não existe conta com este e-mail" de "senha
-- incorreta", para o app pedir CADASTRO em vez de mandar resetar senha à toa.
--
-- SECURITY DEFINER lê auth.users (fora do alcance do usuário). Retorna só um
-- booleano (existe/não existe) — nada de dados sensíveis. Liberado para anon
-- porque a checagem acontece ANTES do login.
create or replace function public.email_existe(e text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(e))
  );
$$;

revoke all on function public.email_existe(text) from public;
grant execute on function public.email_existe(text) to anon, authenticated;
