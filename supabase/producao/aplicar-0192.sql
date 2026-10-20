-- Viva Nomads — 0192: cartão do parceiro (Prompt 31c). Idempotente (if not exists / create or replace / drop if exists).
-- Rollback: supabase/producao/rollback/0192_rollback.sql. Aplicada pela Action quando o PR é mesclado.
begin;
set local lock_timeout = '5s';

-- 0192 — Cartão do parceiro (Prompt 31c): o mesmo motor dos cartões da 0186, com o tipo novo 'partnercard'.
--  1. cartoes_compartilhaveis: tipo 'partnercard' (um por parceiro), coluna parceiro_id (FK parceiros, cascade) e
--     property_id passa a aceitar nulo. Check: partnercard ⇔ parceiro_id preenchido e property_id nulo; poststay e
--     ownercard continuam exigindo property_id (e sem parceiro_id). O índice "um por alvo" passa a cobrir o parceiro.
--  2. parceiro_pedidos.ref_codigo / ref_tipo: o pedido que chegou por um cartão guarda o código e o tipo (igual a
--     leads.ref_*). Quem grava é o servidor (31b), só com a visita assinada.
--  3. eventos: as métricas novas ref_partner_views e ref_partner_requests (a lista da 0186 continua inteira),
--     cartao_tipo aceita 'partnercard' e a coluna parceiro_id diz de qual parceiro é a métrica.
--  4. ref_partner_requests nasce no banco quando o pedido com ref de cartão partnercard é criado (uma vez por pedido;
--     o código tem de ser da conta do próprio parceiro).
-- RLS igual à da 0186: só o servidor (service_role) grava; a pessoa lê os próprios cartões. Reaplicar é seguro.

-- ── 1. Cartões ───────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.cartoes_compartilhaveis add column if not exists parceiro_id uuid references public.parceiros (id) on delete cascade;
alter table public.cartoes_compartilhaveis alter column property_id drop not null;
alter table public.cartoes_compartilhaveis drop constraint if exists cartoes_compartilhaveis_tipo_check;
alter table public.cartoes_compartilhaveis add constraint cartoes_compartilhaveis_tipo_check check (tipo in ('poststay', 'ownercard', 'partnercard'));
alter table public.cartoes_compartilhaveis drop constraint if exists cartoes_alvo_check;
alter table public.cartoes_compartilhaveis add constraint cartoes_alvo_check check (
  (tipo = 'partnercard' and parceiro_id is not null and property_id is null)
  or (tipo in ('poststay', 'ownercard') and property_id is not null and parceiro_id is null)
);
drop index if exists public.cartoes_um_por_alvo;
create unique index if not exists cartoes_um_por_alvo on public.cartoes_compartilhaveis (
  tipo, usuario_id,
  coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(contrato_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parceiro_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index if not exists cartoes_parceiro_idx on public.cartoes_compartilhaveis (parceiro_id) where parceiro_id is not null;

-- ── 2. Atribuição do pedido de serviço ───────────────────────────────────────────────────────────────────────────
alter table public.parceiro_pedidos add column if not exists ref_codigo text;
alter table public.parceiro_pedidos add column if not exists ref_tipo text;
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_ref_check;
alter table public.parceiro_pedidos add constraint parceiro_pedidos_ref_check check (
  (ref_codigo is null and ref_tipo is null)
  or (ref_codigo ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$' and ref_tipo = 'partnercard')
);
create index if not exists parceiro_pedidos_ref_idx on public.parceiro_pedidos (parceiro_id) where ref_tipo is not null;

-- ── 3. Eventos ───────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.eventos add column if not exists parceiro_id uuid references public.parceiros (id) on delete set null;
create index if not exists eventos_parceiro_idx on public.eventos (parceiro_id, tipo) where parceiro_id is not null;
alter table public.eventos drop constraint if exists eventos_cartao_tipo_check;
alter table public.eventos add constraint eventos_cartao_tipo_check check (cartao_tipo is null or cartao_tipo in ('poststay', 'ownercard', 'partnercard'));
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio',
  'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings',
  'ref_partner_views', 'ref_partner_requests'
));

-- ── 4. ref_partner_requests: o pedido criado com o código de um cartão do parceiro (uma vez por pedido) ─────────
create or replace function public.cartao_ref_pedido_parceiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ref_codigo is null or new.ref_tipo is distinct from 'partnercard' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.ref_codigo is not null then
    return new; -- o pedido já tinha atribuição: não conta de novo
  end if;
  -- O código tem de ser da conta do próprio parceiro (o QR assinado é dele).
  if not exists (
    select 1 from public.codigos_compartilhamento c
      join public.parceiros p on p.user_id = c.usuario_id
     where c.codigo = new.ref_codigo and p.id = new.parceiro_id
  ) then
    return new;
  end if;
  if exists (select 1 from public.eventos e where e.tipo = 'ref_partner_requests' and e.origem_campaign = new.codigo) then
    return new;
  end if;
  insert into public.eventos (tipo, usuario_id, parceiro_id, origem_source, origem_medium, origem_campaign, cartao_tipo, plataforma)
  values ('ref_partner_requests', null, new.parceiro_id, 'cartao', 'partnercard', new.codigo, 'partnercard', 'web');
  return new;
end;
$$;
drop trigger if exists trg_cartao_ref_pedido_parceiro on public.parceiro_pedidos;
create trigger trg_cartao_ref_pedido_parceiro
  after insert or update of ref_codigo, ref_tipo on public.parceiro_pedidos
  for each row execute function public.cartao_ref_pedido_parceiro();
revoke all on function public.cartao_ref_pedido_parceiro() from public, anon, authenticated;

-- RLS (igual à 0186): as tabelas continuam só com leitura do dono; as colunas novas seguem as políticas existentes.
alter table public.cartoes_compartilhaveis enable row level security;
revoke all on public.cartoes_compartilhaveis from anon, authenticated;
grant select on public.cartoes_compartilhaveis to authenticated;

-- Conferência (somente leitura):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'eventos_tipo_check';          -- inclui ref_partner_requests
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'cartoes_alvo_check';          -- partnercard ⇔ parceiro_id
--   select count(*) from public.cartoes_compartilhaveis where tipo = 'partnercard';                    -- 0 logo depois de aplicar

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000192', '0192_cartao_parceiro',
       array['-- conteúdo em supabase/migrations/0192_cartao_parceiro.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000192');
commit;
