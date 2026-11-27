/*
  E1008 (Gerente, ronda 03:49 de 17/11/2026; família do E1006) — a régua "fixo" da varredura (controlesCobertos,
  tests/e2e/fixtures/varredura.ts) acusava, na Busca a 390 px (t407), o cartão do anúncio como "coberto por elemento
  fixo mesmo depois de rolar até ele". A régua só tentava o controle no MEIO da tela; com a barra de filtros fixa até
  312 px (E946), os cantos de cima de um cartão de 402 px centrado ficam debaixo dela, embora rolar mostre o cartão.
  A régua passa a tentar três posições (meio, fim e começo) e só acusa o ponto que fica debaixo de um fixo em todas.
  Prova ao vivo: tests/e2e/specs/t1686-e1008-varredura-fixo-alto.spec.ts.
  Roda: node --test tests/laboratorio/e1008-varredura-fixo-alto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("tests/e2e/fixtures/varredura.ts", "utf8");
const regua = src.slice(src.indexOf("export async function controlesCobertos"), src.indexOf("/** (f) Clica e exige resposta visível"));
const confere = regua.slice(regua.indexOf("const continuaCoberto"), regua.indexOf("const out: string[] = [];"));

test("a conferência tenta o controle no meio, no fim e no começo da tela", () => {
  assert.match(confere, /for \(const block of \["center", "end", "start"\] as const\) \{/);
  assert.match(confere, /el\.scrollIntoView\(\{ block, inline: "nearest", behavior: "instant" \}\);/);
});

test("só acusa o ponto que ficou debaixo de um fixo em todas as posições em que apareceu", () => {
  // Os mesmos cinco pontos de antes: o centro e os quatro cantos.
  assert.match(confere, /const PONTOS = \[\[0\.5, 0\.5\], \[0\.15, 0\.15\], \[0\.85, 0\.15\], \[0\.15, 0\.85\], \[0\.85, 0\.85\]\];/);
  assert.match(confere, /if \(cobre\(el, t\)\) tampa\[i\] \?\?= t;\s*else revelado\[i\] = true;/);
  assert.match(confere, /const i = tampa\.findIndex\(\(t, k\) => t && !revelado\[k\]\);/);
  assert.match(confere, /return i >= 0 \? tampa\[i\] : null;/);
  // A página volta para onde estava, como antes.
  assert.match(confere, /window\.scrollTo\(\{ top: salvo, behavior: "instant" \}\);/);
});

test("a régua não afrouxou: os dois achados, as exceções de antes e a medida do E1006 continuam lá", () => {
  assert.match(regua, /coberto por elemento fixo mesmo depois de rolar até ele/);
  assert.match(regua, /else if \(!fixoOuSticky\(topo\)\) out\.push\(`"\$\{nome\(el\)\}" coberto por \$\{topo\.tagName\.toLowerCase\(\)\} "\$\{nome\(topo\)\}"`\);/);
  assert.match(regua, /const cobre = \(el: Element, t: Element \| null\) => !!t && !setaDaFileira\(t\) && !\(el === t \|\| el\.contains\(t\) \|\| t\.contains\(el\)\) && fixoOuSticky\(t\) && !fixoOuSticky\(el\);/);
  assert.equal((regua.match(/caixaDeMedida\(el\)/g) ?? []).length, 2);
  // Nenhuma exceção nova por tela, rota ou texto: a mudança é só em quais posições de rolagem a régua confere.
  // (Confere o código, sem os comentários, que citam a Busca como o caso que mostrou o defeito.)
  const codigo = regua.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(codigo, /buscar|Busca|Mapa|filtros/);
});

test("a t407 continua cobrando a Busca com o km, sem achado conhecido novo para ela", () => {
  const t407 = readFileSync("tests/e2e/specs/t407-varredura-bloco26.spec.ts", "utf8");
  assert.match(t407, /nome: "Buscar com o km até o local digitado \(#1270, #1291\)"/);
  const conhecidos = t407.slice(t407.indexOf("const CONHECIDOS"), t407.indexOf("];", t407.indexOf("const CONHECIDOS")));
  assert.doesNotMatch(conhecidos, /coberto por/);
});
