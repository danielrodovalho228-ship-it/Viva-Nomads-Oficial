import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_COMISSAO_PADRAO } from "./cobranca/regra.ts";

// E667: /modelodenegocio dizia "20+ imóveis · Plano Gestor 4%" e, na mesma página, "31+ segue em 6% até negociar".
// A faixa "31+ negociável" saiu na decisão de 04/11: Gestor = 4% a partir de 20 imóveis (ou administradora).
// Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% também saiu — a última faixa (sem teto) começa em
// 16, a 6%, e a legenda do gráfico traz a linha das carteiras (TEXTO_CARTEIRAS) no lugar do texto do Gestor.
const src = readFileSync(new URL("../components/modelo-negocio/modelo-negocio.tsx", import.meta.url), "utf8");

test("E667: a página não fala mais em 31+ nem em 'até negociar'", () => {
  assert.doesNotMatch(src, /31\+/);
  assert.doesNotMatch(src, /até negociar/);
});

test("E667/078: o gráfico por faixa rotula a última faixa pelo mínimo dela (16+) e a legenda usa a linha única das carteiras", () => {
  // 078 (Daniel, 16/11/2026): antes FAIXA_GESTOR.minImoveis === 20 (a faixa sem teto era a do Gestor, a 4%); FAIXA_GESTOR saiu e a
  // faixa sem teto é a última da escada: 16 ou mais, 6%.
  assert.deepEqual(FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1], { minImoveis: 16, maxImoveis: null, taxa: 0.06 });
  assert.equal(FAIXAS_COMISSAO_PADRAO.filter((f) => f.maxImoveis === null).length, 1);
  assert.match(src, /f\.maxImoveis === null \? `\$\{f\.minImoveis\}\+`/);
  // 078 (Daniel, 16/11/2026): antes /no limite inferior de cada faixa\. Plano Gestor: \{GESTOR_TEXTO\}\./
  assert.match(src, /no limite inferior de cada faixa\. \{TEXTO_CARTEIRAS\}<\/p>/);
  // 078 (Daniel, 16/11/2026): e a página não cita mais o Plano Gestor nem marca faixa como Gestor.
  assert.doesNotMatch(src, /Plano Gestor|GESTOR_TEXTO|f\.gestor/);
});
