import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

// Varredura 01/11 (achado 6): links de texto soltos tinham 17–20 px de altura no celular, sem a área de toque de 44 px
// (`.alvo-toque`, globals.css). Os que a varredura a 390 px mediu agora a usam.
test("links soltos medidos a 390 px usam a área de toque ampliada", () => {
  const casos: [string, RegExp][] = [
    ["app/(dashboard)/dashboard/visao-geral-client.tsx", /className="alvo-toque mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest/],
    ["app/(dashboard)/dashboard/visao-geral-client.tsx", /className="alvo-toque text-sm font-medium text-forest hover:underline" data-testid="inicio-recomendados-todos"/],
    ["components/precos/comparativo-precos.tsx", /<Link href="\/precos#compare" className="alvo-toque /],
    ["app/(public)/cidades/[cidade]/page.tsx", /<Link href="\/" className="alvo-toque /],
    ["app/(public)/cidades/[cidade]/[polo]/page.tsx", /<Link href="\/" className="alvo-toque /],
    ["components/cidades/bairro-pagina.tsx", /<Link href="\/" className="alvo-toque /],
    // E1033, passo 3 (asserção alterada, ORDEM-DUET-239): os 3 links da família "parceiros" (os dos cartões, o do
    // avaliador e o dos passos do credenciamento) saíram desta lista. Têm agora a área de 44 px com qualquer apontador,
    // cobrada em e1033-passo3-parceiros.test.ts. O do credenciamento continua a levar a HREF_PASSOS_CREDENCIAMENTO (E902).
  ];
  for (const [arq, re] of casos) assert.match(ler(arq), re, arq);
  // A área de 44 px continua definida.
  assert.match(ler("app/globals.css"), /\.alvo-toque::after \{[\s\S]{0,120}height: 44px;/);
});
