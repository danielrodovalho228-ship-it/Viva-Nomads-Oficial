-- ENSAIO DE QUEBRA (Pista 3, #3904) — NUNCA MERGEAR. Desfaz a 0300: o gatilho de coerência volta a rodar só no UPDATE,
-- e um anúncio INSERIDO pausado fica sem motivo (o defeito do E509). Serve para provar que o t2089 fica vermelho.
drop trigger if exists trg_properties_pausa_coerente on public.properties;
create trigger trg_properties_pausa_coerente before update of status on public.properties
  for each row execute function public.properties_pausa_coerente();
