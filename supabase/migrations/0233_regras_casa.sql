-- 0233: regras da casa ESTRUTURADAS no anúncio (CAMPOS-1, item 1 do adendo de campos de 23/10).
-- Uma coluna jsonb, nula = nada definido. Formato validado no servidor (src/lib/anuncio/regras-casa.ts):
--   {silencio?: {inicio "HH:MM", fim "HH:MM"}, fumo?: proibido|permitido|area_externa, festas?: proibido|permitido,
--    visitas?: {permitidas bool, ate? "HH:MM", pernoite? bool}}
-- Os fatos antigos (max_guests, pets_allowed, smoking_allowed, checkin/out) continuam como estão.
alter table public.properties add column if not exists regras_casa jsonb;
do $$ begin
  alter table public.properties add constraint properties_regras_casa_objeto
    check (regras_casa is null or jsonb_typeof(regras_casa) = 'object');
exception when duplicate_object then null; end $$;
comment on column public.properties.regras_casa is
  'Regras da casa estruturadas (silêncio, fumo, festas, visitas). Validado em src/lib/anuncio/regras-casa.ts. Público como o resto do anúncio.';
-- A 0053 deixou o SELECT de properties por coluna (ver 0125/0147): sem o grant a página leria NULL.
grant select (regras_casa) on public.properties to anon, authenticated;
