/*
  E1006 — a régua "fixo" da varredura (controlesCobertos, tests/e2e/fixtures/varredura.ts) acusava, em Meus imóveis a
  390 px (t622), os links em linha de "Falta para publicar" como cobertos pelo link vizinho. Num link que quebra de linha
  a caixa do elemento (getBoundingClientRect) é a união das linhas, e o centro dela cai em cima do vizinho.
  A régua passa a medir o controle em linha que quebra pela 1ª caixa de linha (getClientRects()[0]). A asserção fica:
  o que cobre o controle nesse ponto continua acusado. Prova ao vivo: tests/e2e/specs/t1679-e1006-varredura-link-que-quebra.spec.ts.
  Roda: node --test tests/laboratorio/e1006-varredura-link-que-quebra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("tests/e2e/fixtures/varredura.ts", "utf8");
const regua = src.slice(src.indexOf("export async function controlesCobertos"), src.indexOf("/** (f) Clica e exige resposta visível"));

test("controlesCobertos mede o controle em linha que quebra pela 1ª caixa de linha", () => {
  assert.match(regua, /const caixaDeMedida = \(el: Element\): DOMRect => \{/);
  assert.match(regua, /const linhas = el\.getClientRects\(\);/);
  assert.match(regua, /return linhas\.length > 1 \? linhas\[0\] : el\.getBoundingClientRect\(\);/);
  // As duas medidas da régua usam a mesma caixa: a 1ª passada e a conferência depois de rolar até o controle.
  assert.equal((regua.match(/caixaDeMedida\(el\)/g) ?? []).length, 2);
});

test("a régua não afrouxou: os dois achados e as exceções de antes continuam lá", () => {
  assert.match(regua, /coberto por elemento fixo mesmo depois de rolar até ele/);
  assert.match(regua, /else if \(!fixoOuSticky\(topo\)\) out\.push\(`"\$\{nome\(el\)\}" coberto por \$\{topo\.tagName\.toLowerCase\(\)\} "\$\{nome\(topo\)\}"`\);/);
  assert.match(regua, /if \(!topo \|\| el === topo \|\| el\.contains\(topo\) \|\| topo\.contains\(el\)\) continue;/);
  assert.match(regua, /if \(setaDaFileira\(topo\)\) continue;/);
  // Nenhuma exceção nova por tela, rota ou texto: a mudança é só a caixa medida.
  assert.doesNotMatch(regua, /falta-publicar|dashboard\/imoveis|Falta para publicar/);
});

test("a t622 continua cobrando a tela de Meus imóveis, sem achado conhecido novo para ela", () => {
  const t622 = readFileSync("tests/e2e/specs/t622-varredura-bloco56.spec.ts", "utf8");
  assert.match(t622, /nome: "Meus imóveis com só um rascunho", rota: \(\) => "\/dashboard\/imoveis"/);
  const conhecidos = t622.slice(t622.indexOf("const CONHECIDOS"), t622.indexOf("];", t622.indexOf("const CONHECIDOS")));
  assert.doesNotMatch(conhecidos, /coberto por/);
});
