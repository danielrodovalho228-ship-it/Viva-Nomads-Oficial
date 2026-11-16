/*
  T2067 — E974 (Pista 3; autorizado pelo Gerente na ronda 02:55Z; E974 alargado): a leitura das etiquetas de um spec
  (`etiquetasDoSpec`) não pode parar no primeiro apóstrofo NEM na primeira aspa de dentro do título — o título vai até
  a MESMA aspa que o abriu. Casos reais: o t2050 e o t2052 (apóstrofo em "…") e o t2061 (aspas "Mais filtros" dentro de
  `…`), que escondiam @E631 / @E734 / @ao-vivo-seguro da prova automática do E951. Correção do Code 2 (#3877).
  Trava unitária: vermelha na main até a correção entrar.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { etiquetasDoSpec } from "./prova-ao-vivo.ts";

const BQ = "`";

test("T2067 — apóstrofo dentro de um título entre aspas duplas não esconde as etiquetas", () => {
  const fonte = `test("T2052 — E631: a página d'ajuda do parceiro @E631 @ao-vivo-seguro", async ({ page }) => {});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E631", "@ao-vivo-seguro"]);
});

test("T2067 — apóstrofo dentro de um título em crase não esconde as etiquetas", () => {
  const fonte = `test(${BQ}T2050 — E579: o filtro d'Uberlândia a \${largura} px @E579 @ao-vivo-seguro${BQ}, async () => {});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E579", "@ao-vivo-seguro"]);
});

test("T2067 — aspas duplas dentro de um título em crase não escondem as etiquetas (o caso do t2061)", () => {
  const fonte = `test(${BQ}T2061 — E734: a \${largura} px, Esc fecha "Mais filtros" e o foco volta @E734 @ao-vivo-seguro${BQ}, async () => {});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E734", "@ao-vivo-seguro"]);
});

test("T2067 — aspas duplas dentro de um título entre aspas simples não escondem as etiquetas", () => {
  const fonte = `test('T2063 — E919: o cartão diz "reparos e manutenção leve" @E919 @ao-vivo-seguro', async () => {});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E919", "@ao-vivo-seguro"]);
});

test("T2067 — aspa escapada dentro de um título do mesmo tipo de aspa", () => {
  const fonte = `test("T — o anúncio diz \\"Ver o caminho para morar\\" @E733 @ao-vivo-seguro", async () => {});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E733", "@ao-vivo-seguro"]);
  const simples = `test('T — a página d\\'ajuda @E941', async () => {});`;
  assert.deepEqual(etiquetasDoSpec(simples), ["@E941"]);
});

test("T2067 — test.describe e test.skip com apóstrofo e aspas também são lidos", () => {
  const fonte = [
    `test.describe("Bloco d'ajuda @E941", () => {`,
    `  test.skip(${BQ}caso "sem sessão" @E970${BQ}, async () => {});`,
    `});`,
  ].join("\n");
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E941", "@E970"]);
});

test("T2067 — o título acaba na sua aspa: nada do corpo do teste nem do teste seguinte entra como etiqueta", () => {
  const fonte = [
    `test("T — a página d'ajuda @E1", async ({ page }) => {`,
    `  await page.goto("/ajuda?x=@E2");`,
    `  const nota = 'aviso @E3';`,
    `});`,
    `test(${BQ}T — diz "x" @E4${BQ}, async () => { const y = ${BQ}@E5${BQ}; });`,
  ].join("\n");
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E1", "@E4"]);
});

test("T2067 — os casos que já funcionavam seguem iguais (título limpo e tag: [...])", () => {
  assert.deepEqual(etiquetasDoSpec(`test("T — limpo @E10 @ao-vivo-seguro", async () => {});`), ["@E10", "@ao-vivo-seguro"]);
  assert.deepEqual(
    etiquetasDoSpec(`test("T — sem etiqueta no título", { tag: ["@E11", "@ao-vivo-seguro"] }, async () => {});`),
    ["@E11", "@ao-vivo-seguro"],
  );
  assert.deepEqual(etiquetasDoSpec(`test("T — d'ajuda", { tag: "@E12" }, async () => {});`), ["@E12"]);
});
