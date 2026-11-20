import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXA_GESTOR } from "./cobranca/regra.ts";

// E667: /modelodenegocio dizia "20+ imóveis · Plano Gestor 4%" e, na mesma página, "31+ segue em 6% até negociar".
// A faixa "31+ negociável" saiu na decisão de 04/11: Gestor = 4% a partir de 20 imóveis (ou administradora).
const src = readFileSync(new URL("../components/modelo-negocio/modelo-negocio.tsx", import.meta.url), "utf8");

test("E667: a página não fala mais em 31+ nem em 'até negociar'", () => {
  assert.doesNotMatch(src, /31\+/);
  assert.doesNotMatch(src, /até negociar/);
});

test("E667: o gráfico por faixa rotula a última faixa pelo mínimo do Gestor e a legenda usa o texto único do Gestor", () => {
  assert.equal(FAIXA_GESTOR.minImoveis, 20);
  assert.match(src, /f\.maxImoveis === null \? `\$\{f\.minImoveis\}\+`/);
  assert.match(src, /no limite inferior de cada faixa\. Plano Gestor: \{GESTOR_TEXTO\}\./);
});
