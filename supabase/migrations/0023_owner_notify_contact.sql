-- 0023_owner_notify_contact.sql
-- Contato de notificação do proprietário para o fluxo de leads.
--
-- Ao solicitar um lead, a plataforma precisa do e-mail/telefone do dono para
-- notificá-lo. A leitura direta de `profiles` pela sessão do INQUILINO é
-- bloqueada pela RLS ("perfil próprio"), então o contato caía no fallback
-- (e-mail do admin) e o dono real NUNCA era notificado.
--
-- Esta função SECURITY DEFINER devolve o contato do dono APENAS para imóveis
-- ATIVOS (anúncios públicos, onde o dono já quer receber interessados). É usada
-- somente no servidor (server action requestLead) e nunca expõe o contato ao
-- cliente.

create or replace function public.owner_notify_contact(prop_id uuid)
returns table (full_name text, email text, phone text)
language sql
security definer
set search_path = public
as $$
  select pf.full_name, pf.email, pf.phone
  from properties pr
  join profiles pf on pf.id = pr.owner_id
  where pr.id = prop_id
    and pr.status = 'active'
  limit 1;
$$;

-- Só usuários autenticados podem executar (o servidor usa a sessão do usuário).
revoke all on function public.owner_notify_contact(uuid) from public;
grant execute on function public.owner_notify_contact(uuid) to authenticated;
