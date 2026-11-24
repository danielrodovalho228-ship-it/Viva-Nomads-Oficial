/*
  E946 — uso real do Daniel (15/11, print no celular, /buscar): a barra quebrava em três linhas e o chip "Nível" ficava
  órfão no começo da segunda — (1) Datas, Local, Tipo, Preço (2) Nível (3) Mais filtros, Ordenar, Mapa. Nova ordem, a mesma
  no celular e no computador: Datas, Local, Tipo, Preço, Mais filtros, Ordenar, Mapa, Nível (por último). A barra segue
  presa e sem deslize lateral (E780, provado pelo Daniel) — guarda visual a 390 px: t1627.
  Roda: node --test src/components/busca/e946-ordem-filtros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORDEM_PILULAS } from "../../lib/busca/pilulas.ts";

const fonte = readFileSync(new URL("./barra-pilulas.tsx", import.meta.url), "utf8");
const barra = fonte.slice(fonte.indexOf('role="toolbar"'), fonte.indexOf("{aberto && ("));
const ORDEM = ["datas", "local", "tipo", "preco", "mais", "ordenar", "mapa", "nivel"];

test("E946: a ordem dos chips é Datas · Local · Tipo · Preço · Mais filtros · Ordenar · Mapa · Nível", () => {
  assert.deepEqual([...ORDEM_PILULAS], ORDEM);
  const desenhada = [...barra.matchAll(/pilula\("(\w+)"\)|data-testid="pilula-(mais|mapa)"/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(desenhada, ORDEM, "a barra desenha os chips nesta ordem");
});

test("E946: o Nível é o último chip da barra (depois do Mapa) e continua só quando há nível para escolher (E452)", () => {
  assert.ok(barra.indexOf('pilula("nivel")') > barra.indexOf('data-testid="pilula-mapa"'));
  assert.match(barra, /\{nivel\.visivel && pilula\("nivel"\)\}/);
});

test("E946: no celular uma sequência só, que quebra linha sem deslize lateral; do tablet para cima, uma linha", () => {
  const classes = (id: string) => {
    const i = fonte.indexOf(`data-testid="${id}"`);
    return fonte.slice(fonte.lastIndexOf("<div", i), i).match(/className="([^"]+)"/)![1].split(/\s+/);
  };
  const linha = classes("linha-pilulas");
  assert.ok(linha.includes("flex") && linha.includes("flex-wrap") && linha.includes("sm:flex-nowrap"), linha.join(" "));
  for (const g of ["pilulas-filtros", "pilulas-acoes"]) {
    const c = classes(g);
    assert.ok(c.includes("contents") && c.includes("sm:flex"), `${g}: ${c.join(" ")}`);
    assert.ok(!c.some((x) => /^overflow-/.test(x)), `${g} sem rolagem lateral no celular`);
  }
});
