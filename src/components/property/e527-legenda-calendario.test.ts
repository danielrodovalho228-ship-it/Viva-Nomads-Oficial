/**
 * E527 (D13, QA de cliques do morador 02/11): na legenda do calendário do anúncio, "Indisponível" aparecia riscado (a
 * própria palavra com line-through) e as amostras de Disponível × Indisponível eram dois verdes-pálidos quase iguais
 * (sage-100 × sage-200/60). Agora: a palavra sem risco; Indisponível em cinza (outra cor, não outro tom de verde); e a
 * legenda e os dias do calendário leem a cor da MESMA constante. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./availability-calendar.tsx", import.meta.url), "utf8");
const legenda = src.slice(src.indexOf('data-testid="calendario-legenda"'), src.indexOf("Resumo da seleção"));

test("a palavra 'Indisponível' da legenda não é riscada", () => {
  assert.ok(legenda.length > 0, "legenda encontrada");
  assert.doesNotMatch(legenda, /line-through/);
});

test("Disponível e Indisponível têm cores de famílias diferentes (verde × cinza), não dois verdes pálidos", () => {
  const cores = src.match(/export const COR_DIA = \{([^}]+)\}/)?.[1] ?? "";
  const disp = cores.match(/disponivel: "([^"]+)"/)?.[1] ?? "";
  const indisp = cores.match(/ocupado: "([^"]+)"/)?.[1] ?? ""; // E666: "indisponível" virou ocupado (cinza cheio) + bloqueado (listrado)
  assert.match(disp, /\bbg-sage-100\b/);
  assert.match(indisp, /\bbg-line\b/);
  assert.doesNotMatch(indisp, /sage/);
});

test("a legenda e os dias usam a mesma constante (a amostra não descola do dia)", () => {
  assert.match(legenda, /COR_DIA\.disponivel/);
  assert.match(legenda, /COR_DIA\.ocupado/);
  assert.match(legenda, /COR_DIA\.bloqueado/);
  const grade = src.slice(0, src.indexOf('data-testid="calendario-legenda"'));
  assert.match(grade, /estado === "indisponivel" && cn\("cursor-not-allowed text-muted line-through", ocupSet\.has\(iso\) \? COR_DIA\.ocupado : COR_DIA\.bloqueado\)/);
  assert.match(grade, /COR_DIA\.disponivel/);
});

// E527 (resíduo, lote 6 de 06/11): as amostras seguiam fracas — "Disponível" era um quadradinho verde quase branco, próximo
// do "Hoje" (branco com anel) e de contraste fraco contra o cinza do "Ocupado". Amostras maiores (16 px) e a de Disponível
// com contorno verde da marca; "Hoje" segue com anel âmbar sobre fundo branco (forma e cor diferentes).
test("as amostras da legenda têm tamanho legível (16 px) e a de Disponível tem contorno verde forte", () => {
  assert.equal((legenda.match(/\bh-4 w-4\b/g) ?? []).length, 5, "todas com 16 px");
  assert.doesNotMatch(legenda, /\bh-3 w-3\b/);
  const disp = legenda.slice(legenda.indexOf("COR_DIA.disponivel") - 80, legenda.indexOf("COR_DIA.disponivel") + 30);
  assert.match(disp, /ring-1 ring-forest/);
  assert.match(legenda, /bg-white ring-2 ring-champagne-600/);
});

// E527 (QA 08/11, rodada 10:45): Ocupado (1,36:1), Bloqueado (1,37:1) e Hoje (2,32:1) seguiam abaixo de 3:1 contra o branco
// (WCAG 1.4.11). Contorno em apoio (#6a6a6a, 5,4:1) nos dois cinzas e anel champagne-600 (#4fa01e, 3,3:1) em Hoje — na
// grade e na legenda, a MESMA regra.
test("E527: Ocupado e Bloqueado têm contorno de 3:1 ou mais; Hoje usa champagne-600 na grade e na legenda", () => {
  const cores = src.match(/export const COR_DIA = \{([^}]+)\}/)?.[1] ?? "";
  assert.match(cores, /ocupado: "bg-line ring-1 ring-inset ring-apoio"/);
  assert.match(cores, /bloqueado:[^\n]*ring-1 ring-inset ring-apoio/);
  assert.doesNotMatch(src, /ring-champagne(?!-600)/);
  assert.equal((src.match(/ring-2 ring-champagne-600/g) ?? []).length, 2, "grade e legenda");
});
