/*
  E1109 (ORDEM-DUET-494; achado D1 da auditoria da ORDEM-493): os Termos de uso diziam "16 a 30 imóveis, 6%; 31 ou
  mais, condição negociada" — a fonte (FAIXAS_COMISSAO_PADRAO, lib/cobranca/regra.ts) tem 16–19 = 6% e o escalão de 20
  ou mais. Correcção só aritmética: "16 a 19" e "20 ou mais", mantendo "condição negociada" como a redação pública do
  escalão de 20+ (se se anuncia como Plano Gestor é pergunta de modelo, com o coordenador — não entra nos Termos).
  Roda: node --test src/lib/cobranca/e1109-termos-escada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_COMISSAO_PADRAO } from "./regra.ts";

const termos = readFileSync("src/app/(public)/termos/page.tsx", "utf8");
const pct = (t: number) => `${Math.round(t * 100)}%`;

test("E1109: a escada dos Termos bate com os escalões da fonte (12/10/8/6 nas faixas 1–2 / 3–5 / 6–15 / 16–19)", () => {
  const comuns = FAIXAS_COMISSAO_PADRAO.filter((f) => !f.gestor);
  const [primeira, ...resto] = comuns;
  const esperado = [
    `${primeira.minImoveis} a ${primeira.maxImoveis} imóveis, ${pct(primeira.taxa)}`,
    ...resto.map((f) => `${f.minImoveis} a ${f.maxImoveis}, ${pct(f.taxa)}`),
  ].join("; ");
  assert.equal(esperado, "1 a 2 imóveis, 12%; 3 a 5, 10%; 6 a 15, 8%; 16 a 19, 6%");
  assert.ok(termos.includes(esperado), "a escada dos Termos é a da fonte");
});

test("E1109: o escalão de cima começa onde a fonte diz, com a redação pública de hoje (condição negociada)", () => {
  const gestor = FAIXAS_COMISSAO_PADRAO.find((f) => f.gestor)!;
  assert.ok(termos.includes(`${gestor.minImoveis} ou mais, condição negociada`));
  assert.doesNotMatch(termos, /16 a 30|31 ou mais/);
  assert.doesNotMatch(termos, /Plano Gestor/, "a redação pública do escalão de 20+ não muda neste item");
});
