-- 0024_message_notify_contact.sql
-- Contato do INTERLOCUTOR para notificar novas mensagens por e-mail.
--
-- Ao enviar uma mensagem, a plataforma notifica o destinatário por e-mail com
-- o link para responder NO SITE (a conversa fica registrada; nunca por e-mail).
-- A RLS de `profiles` ("perfil próprio") impede o remetente de ler o contato
-- do destinatário — esta função SECURITY DEFINER devolve o contato APENAS se
-- já existe relação entre os dois (lead ou mensagem anterior), o que impede
-- usar a RPC para colher e-mails de estranhos.

create or replace function public.message_notify_contact(target uuid)
returns table (full_name text, email text, phone text)
language sql
security definer
set search_path = public
as $$
  select pf.full_name, pf.email, pf.phone
  from profiles pf
  where pf.id = target
    and (
      exists (
        select 1 from leads l
        where (l.owner_id = target and l.tenant_id = auth.uid())
           or (l.owner_id = auth.uid() and l.tenant_id = target)
      )
      or exists (
        select 1 from messages m
        where (m.sender_id = target and m.receiver_id = auth.uid())
           or (m.sender_id = auth.uid() and m.receiver_id = target)
      )
    )
  limit 1;
$$;

revoke all on function public.message_notify_contact(uuid) from public;
grant execute on function public.message_notify_contact(uuid) to authenticated;
