-- ─────────────────────────────────────────────────────────────
-- Rodada 11 — qualidade do anúncio (mínimo de fotos + tiers)
-- ─────────────────────────────────────────────────────────────

create type listing_quality_tier as enum ('padrao', 'completo', 'premium');

alter table properties
  add column photo_count int not null default 0,
  add column listing_quality_tier listing_quality_tier not null default 'padrao';

-- Mantém photo_count e o tier sincronizados com as fotos do anúncio.
create or replace function recalc_listing_quality(p_property uuid)
returns void
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count from property_photos where property_id = p_property;
  update properties
    set photo_count = v_count,
        listing_quality_tier = case
          when v_count >= 20 then 'premium'::listing_quality_tier
          when v_count >= 12 then 'completo'::listing_quality_tier
          else 'padrao'::listing_quality_tier
        end
  where id = p_property;
end;
$$;

create or replace function trg_recalc_listing_quality()
returns trigger
language plpgsql
as $$
begin
  perform recalc_listing_quality(coalesce(new.property_id, old.property_id));
  return null;
end;
$$;

create trigger property_photos_quality
  after insert or delete on property_photos
  for each row execute function trg_recalc_listing_quality();

-- Regra de publicação: mínimo de 8 fotos para ativar o anúncio.
create or replace function enforce_min_photos()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and coalesce(new.photo_count, 0) < 8 then
    raise exception 'Anúncio precisa de pelo menos 8 fotos para ser publicado.';
  end if;
  return new;
end;
$$;

create trigger properties_min_photos
  before update of status on properties
  for each row execute function enforce_min_photos();
