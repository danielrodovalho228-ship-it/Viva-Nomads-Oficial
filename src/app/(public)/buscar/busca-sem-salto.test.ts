/*
  Estabilidade da /buscar (02/11, Pista A): a coluna do mapa era decidida pelo matchMedia (só no navegador) — no 1º
  desenho a lista ocupava 100% e encolhia para 58% quando o mapa entrava (layout shift 0,30 a 1280 px; o limite bom é
  0,1). Agora a coluna é reservada pelo CSS (lg:) desde o 1º desenho; o mapa continua carregando só no computador.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./search-client.tsx", import.meta.url), "utf8");

test("a largura da lista e a coluna do mapa vêm do CSS, não do matchMedia", () => {
  assert.match(src, /className=\{cn\("min-w-0 lg:py-4", verMapa \? "lg:w-\[58%\]" : "lg:w-full", mapaNoCelular && "hidden lg:block"\)\}/);
  assert.match(src, /mapaNoCelular \? "block h-\[70vh\] w-full lg:hidden" : verMapa \? "hidden lg:block lg:bg-surface-2" : "hidden",/);
  assert.doesNotMatch(src, /comMapa && verMapa \? "lg:w-\[58%\]"/);
  // O componente pesado do mapa segue só no computador.
  assert.match(src, /\{\(\(comMapa && verMapa\) \|\| mapaNoCelular\) && \(\n\s*<SearchMap/);
});
