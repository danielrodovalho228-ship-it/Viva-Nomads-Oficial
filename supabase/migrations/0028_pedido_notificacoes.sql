-- Pedido de Moradia — Fase 4: notificações (in-app + e-mail de verdade; WhatsApp
-- como adapter). Resolve os CONTATOS entre as partes por funções SECURITY
-- DEFINER, respeitando a privacidade (o proprietário nunca lê o e-mail do
-- inquilino direto — só o servidor, via RPC com relação já estabelecida).

-- ── Preferências de notificação (in-app não desliga) ─────────────────────────
alter table profiles add column if not exists notif_email boolean not null default true;
alter table profiles add column if not exists notif_whatsapp boolean not null default true;

-- ── Dedupe do lembrete de expiração (3 dias antes) ───────────────────────────
alter table pedidos_moradia add column if not exists lembrete_expira_em timestamptz;

-- ── Destinatários: proprietários com imóvel ATIVO na cidade do pedido ────────
-- Usado ao publicar um pedido: avisa quem tem imóvel na cidade (opt-in por
-- notif_email). SECURITY DEFINER (o inquilino não lê profiles de terceiros).
create or replace function public.pedido_owner_recipients(cidade_alvo text)
returns table (owner_id uuid, full_name text, email text, phone text, notif_whatsapp boolean)
language sql security definer set search_path = public as $$
  select distinct pf.id, pf.full_name, pf.email, pf.phone, pf.notif_whatsapp
  from properties pr
  join profiles pf on pf.id = pr.owner_id
  where pr.status = 'active'
    and lower(pr.city) = lower(cidade_alvo)
    and pf.notif_email = true
    and pf.email is not null
  limit 200;
$$;
revoke all on function public.pedido_owner_recipients(text) from public;
grant execute on function public.pedido_owner_recipients(text) to authenticated;

-- ── Destinatário: inquilino de um pedido (para avisar de nova resposta) ──────
-- Só devolve o contato se o CHAMADOR (proprietário) já respondeu aquele pedido —
-- impede colher e-mail de inquilinos sem relação. Honra notif_email.
create or replace function public.pedido_inquilino_recipient(pedido uuid)
returns table (full_name text, email text, phone text, notif_whatsapp boolean)
language sql security definer set search_path = public as $$
  select pf.full_name, pf.email, pf.phone, pf.notif_whatsapp
  from pedidos_moradia p
  join profiles pf on pf.id = p.inquilino_id
  where p.id = pedido
    and pf.notif_email = true
    and exists (
      select 1 from respostas_pedido r
      where r.pedido_id = p.id and r.proprietario_id = auth.uid()
    )
  limit 1;
$$;
revoke all on function public.pedido_inquilino_recipient(uuid) from public;
grant execute on function public.pedido_inquilino_recipient(uuid) to authenticated;
