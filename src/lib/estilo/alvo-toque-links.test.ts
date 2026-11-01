import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

// Varredura 01/11 (achado 6): links de texto soltos tinham 17–20 px de altura no celular, sem a área de toque de 44 px
// (`.alvo-toque`, globals.css). Os que a varredura a 390 px mediu agora a usam.
test("links soltos medidos a 390 px usam a área de toque ampliada", () => {
  const casos: [string, RegExp][] = [
    ["app/(public)/parceiros/page.tsx", /<Link key=\{l\.href\} href=\{l\.href\} className="alvo-toque /],
    ["app/(public)/parceiros/page.tsx", /<Link href="\/parceiros\/avaliadores" className="alvo-toque /],
    ["app/(dashboard)/dashboard/visao-geral-client.tsx", /className="alvo-toque mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest/],
    ["app/(dashboard)/dashboard/visao-geral-client.tsx", /className="alvo-toque text-sm font-medium text-forest hover:underline" data-testid="inicio-recomendados-todos"/],
    ["components/precos/comparativo-precos.tsx", /<Link href="\/precos#compare" className="alvo-toque /],
    ["app/(public)/cidades/[cidade]/page.tsx", /<Link href="\/" className="alvo-toque /],
    ["app/(public)/cidades/[cidade]/[polo]/page.tsx", /<Link href="\/" className="alvo-toque /],
    ["components/cidades/bairro-pagina.tsx", /<Link href="\/" className="alvo-toque /],
    ["components/parceiros/seja-parceiro-form.tsx", /<Link href="\/dashboard\/parceiro\/avaliacao" className="alvo-toque /],
  ];
  for (const [arq, re] of casos) assert.match(ler(arq), re, arq);
  // A área de 44 px continua definida.
  assert.match(ler("app/globals.css"), /\.alvo-toque::after \{[\s\S]{0,120}height: 44px;/);
});
