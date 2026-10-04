-- ─────────────────────────────────────────────────────────────────────────────
-- 0066 — coordenadas APROXIMADAS no público. Idempotente.
--
-- properties.lat/lng eram legíveis por anon/authenticated: o mapa desenhava só
-- um círculo, mas o ponto exato do imóvel ia nos dados da página (e iria para
-- o Mapbox). Agora:
--   • lat_exata/lng_exata guardam o ponto real — SEM grant de leitura para
--     anon/authenticated (dono e admin leem pela RPC property_coordenadas);
--   • lat/lng públicos passam a ser um ponto deslocado, FIXO por imóvel, a
--     cerca de 500 m (arredonda a 3 casas e desloca até ±0,004°).
-- O código atual continua igual: quem grava lat/lng grava o ponto real, e o
-- trigger move para as colunas exatas e publica o aproximado.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.properties
  add column if not exists lat_exata double precision,
  add column if not exists lng_exata double precision;

-- Só o servidor/dono (pela RPC) lê o ponto exato.
revoke select (lat_exata, lng_exata) on public.properties from anon, authenticated;
revoke update (lat_exata, lng_exata) on public.properties from anon, authenticated;

create or replace function public.coordenada_aproximada(id uuid, lat double precision, lng double precision)
returns table (lat_ap double precision, lng_ap double precision)
language sql
immutable
as $$
  select
    round(lat::numeric, 3)::double precision
      + ((abs(hashtext(id::text || ':lat')) % 1000) / 1000.0 - 0.5) * 0.008,
    round(lng::numeric, 3)::double precision
      + ((abs(hashtext(id::text || ':lng')) % 1000) / 1000.0 - 0.5) * 0.008
        / greatest(cos(radians(lat)), 0.2);
$$;

-- SECURITY INVOKER de propósito (ver 0052): em DEFINER, current_user seria o
-- dono da função e a checagem "é servidor?" passaria sempre.
create or replace function public.properties_coordenada_publica()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  ap record;
begin
  if tg_op = 'INSERT' then
    if new.lat is not null and new.lng is not null then
      new.lat_exata := new.lat;
      new.lng_exata := new.lng;
    end if;
  else
    -- lat/lng mudaram (nova geocodificação): é o ponto REAL. Reenviar o mesmo
    -- valor público (o editor carrega o aproximado) ou null não mexe no exato.
    if new.lat is not null and new.lng is not null
       and (new.lat is distinct from old.lat or new.lng is distinct from old.lng)
    then
      new.lat_exata := new.lat;
      new.lng_exata := new.lng;
    elsif current_user not in ('service_role', 'supabase_admin', 'postgres') then
      new.lat_exata := old.lat_exata;
      new.lng_exata := old.lng_exata;
    end if;
  end if;

  if new.lat_exata is not null and new.lng_exata is not null then
    select * into ap from public.coordenada_aproximada(new.id, new.lat_exata, new.lng_exata);
    new.lat := ap.lat_ap;
    new.lng := ap.lng_ap;
  else
    new.lat := null;
    new.lng := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_properties_coordenada_publica on public.properties;
create trigger trg_properties_coordenada_publica
  before insert or update of lat, lng, lat_exata, lng_exata on public.properties
  for each row execute function public.properties_coordenada_publica();

-- Backfill: o que estava em lat/lng era o ponto real. Um UPDATE só: o trigger
-- (rodando como dono da migração) mantém o exato e publica o aproximado.
update public.properties p
   set lat_exata = p.lat, lng_exata = p.lng
 where p.lat is not null and p.lng is not null and p.lat_exata is null;

-- Ponto exato: só o dono do imóvel e o admin.
create or replace function public.property_coordenadas(prop_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select p.lat_exata, p.lng_exata
    from public.properties p
   where p.id = prop_id
     and (p.owner_id = auth.uid() or public.is_admin());
$$;
revoke all on function public.property_coordenadas(uuid) from public, anon;
grant execute on function public.property_coordenadas(uuid) to authenticated, service_role;

-- Conferência (rodar depois):
--   select has_column_privilege('anon','public.properties','lat_exata','select');  -- false
--   select count(*) from public.properties where lat is not null and lat = lat_exata; -- 0
