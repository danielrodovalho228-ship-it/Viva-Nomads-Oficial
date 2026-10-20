-- 0186 — Cartões compartilháveis, Fase 1 (só compartilhar: sem recompensa, sem cupom).
--  1. codigos_compartilhamento: um código por conta (XXXX-XXXX, alfabeto sem 0/O/1/I/L), revogável. Revogar = o
--     QR antigo deixa de atribuir; a conta ganha um código novo no próximo cartão.
--  2. cartoes_compartilhaveis: o cartão-postal pós-estadia (poststay, por contrato) e o cartão do anúncio
--     (ownercard, por imóvel). Modelo travado: o único campo escolhido é "mostrar meu primeiro nome" (opt-in).
--  3. leads.ref_codigo / ref_tipo: a candidatura que chegou por um cartão guarda o código e o tipo.
--  4. eventos: as métricas cards_generated, cards_shared, qr_scans, ref_listing_views e ref_bookings, com o tipo
--     do cartão (cartao_tipo). ref_bookings nasce no banco quando as duas partes assinam o contrato de um lead
--     atribuído (uma vez por contrato).
-- Só o servidor grava (service_role); a pessoa lê os próprios cartões e o próprio código. Reaplicar é seguro.

create table if not exists public.codigos_compartilhamento (
  codigo text primary key check (codigo ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);
create unique index if not exists codigos_compartilhamento_um_ativo on public.codigos_compartilhamento (usuario_id) where revogado_em is null;

create table if not exists public.cartoes_compartilhaveis (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('poststay', 'ownercard')),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  contrato_id uuid references public.contratos (id) on delete cascade,
  curto text not null unique check (curto ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$'),
  mostrar_nome boolean not null default false,
  criado_em timestamptz not null default now(),
  compartilhado_em timestamptz,
  constraint cartoes_contrato_so_no_postal check ((tipo = 'poststay') = (contrato_id is not null))
);
create unique index if not exists cartoes_um_por_alvo on public.cartoes_compartilhaveis
  (tipo, usuario_id, property_id, coalesce(contrato_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists cartoes_property_idx on public.cartoes_compartilhaveis (property_id);

alter table public.codigos_compartilhamento enable row level security;
alter table public.cartoes_compartilhaveis enable row level security;
revoke all on public.codigos_compartilhamento from anon, authenticated;
revoke all on public.cartoes_compartilhaveis from anon, authenticated;
grant select on public.codigos_compartilhamento to authenticated;
grant select on public.cartoes_compartilhaveis to authenticated;
drop policy if exists codigos_compartilhamento_dono_le on public.codigos_compartilhamento;
create policy codigos_compartilhamento_dono_le on public.codigos_compartilhamento for select to authenticated using (usuario_id = auth.uid());
drop policy if exists cartoes_compartilhaveis_dono_le on public.cartoes_compartilhaveis;
create policy cartoes_compartilhaveis_dono_le on public.cartoes_compartilhaveis for select to authenticated using (usuario_id = auth.uid());

alter table public.leads add column if not exists ref_codigo text;
alter table public.leads add column if not exists ref_tipo text;
alter table public.leads drop constraint if exists leads_ref_check;
alter table public.leads add constraint leads_ref_check check (
  (ref_codigo is null and ref_tipo is null)
  or (ref_codigo ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$' and ref_tipo in ('poststay', 'ownercard'))
);

alter table public.eventos add column if not exists cartao_tipo text;
alter table public.eventos drop constraint if exists eventos_cartao_tipo_check;
alter table public.eventos add constraint eventos_cartao_tipo_check check (cartao_tipo is null or cartao_tipo in ('poststay', 'ownercard'));
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio',
  'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings'
));

-- ref_bookings: quando o contrato de um lead atribuído passa a ter as duas assinaturas.
create or replace function public.cartao_ref_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if new.assinado_proprietario_em is null or new.assinado_inquilino_em is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.assinado_proprietario_em is not null and old.assinado_inquilino_em is not null then
    return new;
  end if;
  if new.lead_id is null then
    return new;
  end if;
  select l.ref_tipo into v_tipo from public.leads l where l.id = new.lead_id and l.ref_codigo is not null;
  if v_tipo is null then
    return new;
  end if;
  insert into public.eventos (tipo, usuario_id, imovel_id, origem_source, origem_medium, origem_campaign, cartao_tipo, plataforma)
  values ('ref_bookings', null, new.property_id, 'share_card', 'contrato', v_tipo, v_tipo, 'web');
  return new;
end;
$$;
drop trigger if exists trg_cartao_ref_booking on public.contratos;
create trigger trg_cartao_ref_booking
  after insert or update of assinado_proprietario_em, assinado_inquilino_em on public.contratos
  for each row execute function public.cartao_ref_booking();
revoke all on function public.cartao_ref_booking() from public, anon, authenticated;
