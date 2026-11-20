import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

// E1033, passo 3, família "parceiros" (decisões do Gerente, ORDEM-DUET-239): a área de toque de 44 × 44 px vale com
// qualquer apontador. Nos cartões "Tipos de parceria" os links ficam encostados (duas linhas a 36 px): ali é caixa REAL
// de 44 px, porque a área invisível de um invadia o vizinho. Os links isolados usam a área invisível do passo 2.
test("cartões de /parceiros: cada link tem caixa real de 44 px e a linha não soma espaço entre as duas alturas", () => {
  const pagina = ler("app/(public)/parceiros/page.tsx");
  assert.match(pagina, /<Link key=\{l\.href\} href=\{l\.href\} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-blue-700">/);
  // O espaço vertical vem da caixa de 44 px de cada link (gap só na horizontal); as margens compensam a altura a mais,
  // para o primeiro e o último link ficarem onde estavam.
  assert.match(pagina, /<div className="-mb-3 mt-1 flex flex-wrap gap-x-4 text-sm font-semibold text-forest">/);
});

test("links isolados da família parceiros usam a área de toque que vale com qualquer apontador", () => {
  assert.match(ler("app/(public)/parceiros/page.tsx"), /<Link href="\/parceiros\/avaliadores" className="area-de-toque-44 /);
  assert.match(ler("components/parceiros/seja-parceiro-form.tsx"), /<Link href=\{HREF_PASSOS_CREDENCIAMENTO\} className="area-de-toque-44 /);
  assert.match(ler("app/(public)/parceiros/buscar/page.tsx"), /<Link href="\/parceiros" className="area-de-toque-44 /);
});

test("a família parceiros já não usa a classe antiga, que só valia em tela de toque", () => {
  for (const arq of ["app/(public)/parceiros/page.tsx", "app/(public)/parceiros/buscar/page.tsx", "components/parceiros/seja-parceiro-form.tsx"]) {
    assert.doesNotMatch(ler(arq), /alvo-toque/, arq);
  }
});
