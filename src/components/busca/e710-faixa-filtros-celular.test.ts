import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");

// E710: a 390 px "Ordenar" e "Mapa" só apareciam rolando a faixa de filtros para o lado. As três ações ficam numa
// linha própria, fora da faixa que rola.
test("Mais filtros, Ordenar e Mapa ficam no grupo de ações, fora da faixa que rola", () => {
  const abre = (id: string) => fonte.lastIndexOf("<div", fonte.indexOf(`data-testid="${id}"`));
  const faixa = fonte.slice(abre("pilulas-filtros"), abre("pilulas-acoes"));
  const acoes = fonte.slice(abre("pilulas-acoes"), fonte.indexOf("{aberto && ("));
  assert.match(faixa, /overflow-x-auto/);
  for (const t of ['pilula("datas")', 'pilula("local")', 'pilula("tipo")', 'pilula("preco")']) assert.ok(faixa.includes(t), t);
  assert.doesNotMatch(faixa, /pilula-mais|pilula-mapa|pilula\("ordenar"\)/);
  assert.ok(acoes.includes("pilula-mais") && acoes.includes('pilula("ordenar")') && acoes.includes("pilula-mapa"));
  assert.doesNotMatch(acoes, /overflow-x-auto/);
});

test("a linha única continua do tablet para cima (sm:flex-row) e o testid antigo da barra fica no contêiner de tudo", () => {
  assert.match(fonte, /flex flex-col gap-2 pb-1 sm:flex-row sm:items-center" data-testid="linha-pilulas"/);
});

// Lab t106 (360 px): Mais filtros + Ordenar + Mapa somavam 366 px e estouravam a tela em 6 px (rolagem lateral).
// O grupo de ações quebra linha em vez de passar da borda.
test("o grupo de ações pode quebrar linha (a 360 px não há rolagem lateral)", () => {
  assert.match(fonte, /<div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0" data-testid="pilulas-acoes">/);
});
