import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  E780 REABERTO (print do Daniel, 14/11 09:48): a 390 px o primeiro chip da barra de filtros da /buscar saía cortado na
  borda esquerda e a barra de rolagem aparecia sob os chips. A fileira rolava de lado e invadia a margem da página
  (-mx-4 px-4). Regra: no celular a fileira de filtros QUEBRA LINHA — sem rolagem lateral, sem barra, sem invadir a margem.
  Do tablet para cima segue uma linha só. Prova de tela: tests/e2e/specs/t1627-e780-barra-filtros-integra.spec.ts.
*/
const fonte = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");
const classes = (id: string) => {
  const i = fonte.indexOf(`data-testid="${id}"`);
  const tag = fonte.slice(fonte.lastIndexOf("<div", i), i);
  return tag.match(/className="([^"]+)"/)![1].split(/\s+/);
};

test("no celular a fileira de filtros quebra linha e não rola de lado", () => {
  const c = classes("pilulas-filtros");
  assert.ok(c.includes("flex-wrap"), `flex-wrap ausente: ${c.join(" ")}`);
  for (const proibida of ["overflow-x-auto", "overflow-x-scroll", "overflow-auto", "flex-nowrap"]) {
    assert.ok(!c.includes(proibida), `"${proibida}" sem prefixo faz a fileira rolar de lado no celular`);
  }
});

test("a fileira de filtros não invade a margem da página (o 1º chip não encosta na borda)", () => {
  const c = classes("pilulas-filtros");
  assert.ok(!c.some((x) => /^-mx-/.test(x)), `margem negativa no celular: ${c.join(" ")}`);
});

test("do tablet para cima continua uma linha só", () => {
  const c = classes("pilulas-filtros");
  assert.ok(c.includes("sm:flex-nowrap") && c.includes("sm:flex-1"), c.join(" "));
});

test("o grupo de ações também não rola de lado (quebra linha)", () => {
  const c = classes("pilulas-acoes");
  assert.ok(c.includes("flex-wrap") && !c.some((x) => /^overflow-x-/.test(x)), c.join(" "));
});
