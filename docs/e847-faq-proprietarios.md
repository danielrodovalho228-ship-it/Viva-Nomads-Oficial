# E847: `/para-proprietarios` ganha "Perguntas frequentes"

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-017, A-37 (12/11/2026). A página terminava em "A plataforma cuida do trabalho chato" e no rodapé, sem nenhum FAQ. `/empresas` e a página da cidade têm o seu.

## Correção

- `src/lib/ajuda/faq-proprietarios.ts` define 7 perguntas da **fonte única** (`src/lib/atendimento/faq.ts`, as mesmas da Central de Ajuda): quanto custa anunciar, anúncio que não publica, fotógrafo, limpeza durante a estadia, caução, renovação e manutenção.
  - Usa a resposta que o visitante vê. Nenhuma resposta é nova.
  - As perguntas de parceiro e de avaliador ficam de fora: não são para quem anuncia o imóvel.
- A página ganha a seção "Perguntas frequentes" (`data-testid="proprietarios-faq"`).
  - Os blocos ficam abertos, como em `/empresas`. Pela regra do E186, o acordeão só aparece nas páginas de tema da Central.
  - A seção termina com o link "Central de Ajuda" (`/ajuda/proprietarios`) e traz o `FAQPage` em JSON-LD com as mesmas perguntas.

## Teste

`node --test src/lib/ajuda/e847-faq-proprietarios.test.ts`:
- **main:** falha, porque não há fonte do FAQ da página nem a seção.
- **branch:** 3 pass.

Testes do escopo (ajuda, estilo, SEO das páginas públicas, atendimento, seo): **230 pass / 0 fail**. tsc limpo, consistência OK.
