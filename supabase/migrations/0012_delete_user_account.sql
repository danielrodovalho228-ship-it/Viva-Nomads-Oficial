-- ════════════════════════════════════════════════════════════════════
-- Exclusão de conta (LGPD — direito ao esquecimento).
--
-- RPC chamada pelo próprio usuário para apagar DE FATO seus dados pessoais.
-- Remove a linha em auth.users; o ON DELETE CASCADE de `profiles`
-- (id → auth.users) e das demais tabelas (owner_id/tenant_id → profiles)
-- apaga em cascata imóveis, leads, favoritos, mensagens, contratos, etc.
-- SECURITY DEFINER para poder deletar de auth.users; só age sobre o próprio
-- usuário autenticado (auth.uid()), nunca sobre outro.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Não autenticado';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;
