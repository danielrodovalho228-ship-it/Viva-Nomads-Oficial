-- Ordem 580e4686 (achado do Moacir no PR #486): congela no contrato as regras de pets do anúncio
-- na primeira assinatura, para as duas partes assinarem o mesmo resumo/hash. Só adiciona coluna anulável.
alter table public.contratos add column if not exists pets_regras_congeladas jsonb;
