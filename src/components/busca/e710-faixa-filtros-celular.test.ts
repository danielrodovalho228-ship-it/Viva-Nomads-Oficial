import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");

// E710: a 390 px "Ordenar" e "Mapa" só apareciam rolando a faixa de filtros para o lado. As três ações ficam numa
// linha própria, fora da faixa que rola.
test("Mais filtros, Ordenar e Mapa ficam no grupo de ações, fora da faixa de filtros", () => {
  const abre = (id: string) => fonte.lastIndexOf("<div", fonte.indexOf(`data-testid="${id}"`));
  const faixa = fonte.slice(abre("pilulas-filtros"), abre("pilulas-acoes"));
  const acoes = fonte.slice(abre("pilulas-acoes"), fonte.indexOf("{aberto && ("));
  // E780 reaberto (14/11): no celular a faixa de filtros não rola de lado (quebra linha); só do tablet para cima.
  assert.match(faixa, /flex-wrap/);
  assert.doesNotMatch(faixa.replace(/sm:overflow-x-auto/g, ""), /overflow-x-auto/);
  for (const t of ['pilula("datas")', 'pilula("local")', 'pilula("tipo")', 'pilula("preco")']) assert.ok(faixa.includes(t), t);
  assert.doesNotMatch(faixa, /pilula-mais|pilula-mapa|pilula\("ordenar"\)/);
  assert.ok(acoes.includes("pilula-mais") && acoes.includes('pilula("ordenar")') && acoes.includes("pilula-mapa"));
  assert.doesNotMatch(acoes, /overflow-x-auto/);
});

// E946 (asserção alterada, 15/11): no celular os chips correm numa sequência só (os grupos viram display: contents), para
// o Nível ir por último sem ficar órfão; do tablet para cima, os dois grupos voltam e a barra é uma linha só.
test("a linha única continua do tablet para cima e o testid antigo da barra fica no contêiner de tudo", () => {
  assert.match(fonte, /className="flex flex-wrap items-center gap-2 pb-1 sm:flex-nowrap" data-testid="linha-pilulas"/);
});

// Lab t106 (360 px): Mais filtros + Ordenar + Mapa somavam 366 px e estouravam a tela em 6 px (rolagem lateral).
// O grupo de ações quebra linha em vez de passar da borda.
test("o grupo de ações pode quebrar linha (a 360 px não há rolagem lateral)", () => {
  // E946: no celular o grupo some do layout (contents) e os chips quebram linha na barra; do tablet para cima volta a flex.
  assert.match(fonte, /<div className="contents min-w-0 flex-wrap items-center gap-2 sm:flex sm:shrink-0" data-testid="pilulas-acoes">/);
});
