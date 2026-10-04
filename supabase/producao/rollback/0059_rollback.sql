-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0059 (pedido_prazo_cidade). Rode tudo de uma vez no SQL Editor.
-- A correção de grafia das cidades NÃO é desfeita (só uniformizou acentos).
-- ════════════════════════════════════════════════════════════════════════════
begin;
alter table public.pedidos_moradia drop constraint if exists pedidos_moradia_prazo_meses_check;
alter table public.pedidos_moradia
  add constraint pedidos_moradia_prazo_meses_check check (prazo_meses between 1 and 12);

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

drop function if exists public.chave_cidade(text);
commit;
