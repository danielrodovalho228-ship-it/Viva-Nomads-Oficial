-- 0144: pacote de limpeza durante a estadia no anúncio (ordem 4c74ac38, item 3).
-- Coluna nova, nula = sem pacote. Formato validado no servidor (src/lib/anuncio/limpeza-estadia.ts).
alter table public.properties add column if not exists limpeza_estadia jsonb;
comment on column public.properties.limpeza_estadia is 'Pacote de limpeza durante a estadia: {porMes (1|2|4), inclui, valorMes}. Validado em src/lib/anuncio/limpeza-estadia.ts.';
