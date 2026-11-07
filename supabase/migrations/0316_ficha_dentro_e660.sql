-- E660 (frente aprovada pelo Daniel em 07/11/2026) — Ficha "o que tem dentro": camas por quarto, enxoval, cozinha
-- equipada e ar-condicionado por quarto (inventário de pratos/talheres opcional). Duas colunas aditivas e anuláveis:
--   properties.ficha_dentro            — a ficha viva do anúncio (o dono edita);
--   contratos.ficha_dentro_congelada   — a cópia que congela na 1ª assinatura (aditivo gera nova versão do contrato).
-- Sem dado pessoal. Anúncios antigos ficam com null e continuam funcionando (a ficha é pedida na publicação nova/edição).
alter table public.properties add column if not exists ficha_dentro jsonb;
alter table public.contratos add column if not exists ficha_dentro_congelada jsonb;

comment on column public.properties.ficha_dentro is 'E660: ficha do que tem dentro (quartos/camas/ar, enxoval, cozinha, utensílios opcionais). null = anúncio anterior à ficha.';
comment on column public.contratos.ficha_dentro_congelada is 'E660: ficha congelada na 1ª assinatura ({ficha, congeladaEm}); é o que se confere na entrada.';
