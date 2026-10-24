-- 0235: CAMPOS-2 — detalhes opcionais do anúncio, cada grupo atrás de um toggle (padrão E56).
-- Uma coluna jsonb, nula = nada definido; grupo desligado não existe. Formato validado no servidor
-- (src/lib/anuncio/detalhes-anuncio.ts):
--   {incluidoNoPreco?: [...], areasCondominio?: [...], andar?: {andar, elevador?},
--    janela?: {entradaDe?, entradaAte?, saidaAte?}, vaga?: {coberta?, tipo?, observacao?}}
alter table public.properties add column if not exists detalhes_anuncio jsonb;
do $$ begin
  alter table public.properties add constraint properties_detalhes_anuncio_objeto
    check (detalhes_anuncio is null or jsonb_typeof(detalhes_anuncio) = 'object');
exception when duplicate_object then null; end $$;
comment on column public.properties.detalhes_anuncio is
  'CAMPOS-2: incluído no preço, áreas do condomínio, andar/elevador, janela de entrada/saída, detalhe da vaga. Validado em src/lib/anuncio/detalhes-anuncio.ts. Público como o resto do anúncio.';
-- O SELECT de properties é por coluna (0053; ver 0147/0233): sem o grant a página leria NULL.
grant select (detalhes_anuncio) on public.properties to anon, authenticated;
