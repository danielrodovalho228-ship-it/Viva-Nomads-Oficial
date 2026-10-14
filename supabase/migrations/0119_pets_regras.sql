-- 0119: regras de pets do proprietário no anúncio (ordem 022afabb, item 2).
-- Coluna nova, nula = só vale o "aceita pets" geral. Formato validado no servidor.
alter table public.properties add column if not exists pets_regras jsonb;
comment on column public.properties.pets_regras is 'Regras de pets: {especies[], porteMax, qtdMax, reforcoCaucao, regrasCondominio}. Validado em src/lib/anuncio/pets-regras.ts.';
