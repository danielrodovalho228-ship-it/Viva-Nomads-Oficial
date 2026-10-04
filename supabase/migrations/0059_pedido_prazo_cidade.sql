-- ════════════════════════════════════════════════════════════════════════════
-- 0059 — Pedido de Moradia: prazo de 30 a 180 dias e cidade sem duplicata.
--
--   1. prazo_meses passa de 1–12 para 1–6 (a plataforma é de 30 a 180 dias).
--      Nenhum pedido em produção passa de 6 meses (conferido em 04/10).
--   2. chave_cidade(t): sem acento e minúscula — "Uberlandia" = "Uberlândia".
--   3. pedido_owner_recipients compara pela chave (antes: lower(), que separava
--      as grafias com e sem acento). Mantém os grants (create or replace).
--   4. Corrige os pedidos já gravados: grafias da MESMA cidade/UF passam a usar
--      a versão acentuada (o código novo já grava o nome oficial do IBGE).
--
-- Rollback: supabase/producao/rollback/0059_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. prazo
alter table public.pedidos_moradia drop constraint if exists pedidos_moradia_prazo_meses_check;
alter table public.pedidos_moradia
  add constraint pedidos_moradia_prazo_meses_check check (prazo_meses between 1 and 6);

-- 2. chave de cidade (immutable: pode ser usada em índice)
create or replace function public.chave_cidade(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'));
$$;

-- 3. destinatários do aviso de novo pedido (só o servidor executa — 0053)
create or replace function public.pedido_owner_recipients(cidade_alvo text)
returns table (owner_id uuid, full_name text, email text, phone text, notif_whatsapp boolean)
language sql security definer set search_path = public as $$
  select distinct pf.id, pf.full_name, pf.email, pf.phone, pf.notif_whatsapp
  from properties pr
  join profiles pf on pf.id = pr.owner_id
  where pr.status = 'active'
    and public.chave_cidade(pr.city) = public.chave_cidade(cidade_alvo)
    and pf.notif_email = true
    and pf.email is not null
  limit 200;
$$;

-- 4. pedidos existentes: mesma cidade/UF escrita de dois jeitos → a acentuada
update public.pedidos_moradia p
   set cidade = c.cidade
  from (
    select distinct on (public.chave_cidade(cidade), coalesce(uf, ''))
           public.chave_cidade(cidade) as chave, coalesce(uf, '') as uf, cidade
      from public.pedidos_moradia
     order by public.chave_cidade(cidade), coalesce(uf, ''),
              (cidade <> translate(cidade,
                 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) desc
  ) c
 where public.chave_cidade(p.cidade) = c.chave
   and coalesce(p.uf, '') = c.uf
   and p.cidade <> c.cidade;
