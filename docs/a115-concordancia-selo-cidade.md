# A-115 (RELATORIO-021) — "Os que têm o selo Pronto para Morar são mobiliado e equipado…"

**Conferido no código:** `src/app/(public)/cidades/[cidade]/page.tsx` montava "Os que têm o selo {nome} são {resumo}", e `SELOS.prontoParaMorar.resumo` é singular ("mobiliado e equipado para morar desde o primeiro dia").
**Correção:** "O selo **Pronto para Morar** marca o imóvel mobiliado e equipado para morar desde o primeiro dia; etiquetas como…". O resumo do selo (fonte única em `src/config/selos.ts`) não muda.
**Teste:** `node --test src/lib/a115-concordancia-selo-cidade.test.ts` — main: pass 0 / fail 1; branch: pass 1 / fail 0. Escopados (a115 + seo): pass 23 / fail 0. tsc limpo; consistência OK.
