/* E780 — o topo da busca no celular fica preso e inteiro: faixa de filtros sticky abaixo do cabeçalho, contagem rola por baixo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
const barra = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");

test("a faixa de filtros fica num contêiner sticky abaixo do cabeçalho (top-18), no fluxo a partir de lg", () => {
  const i = busca.indexOf('data-testid="busca-topo-fixo"');
  assert.ok(i > 0);
  const tag = busca.slice(busca.lastIndexOf("<div", i), i);
  assert.match(tag, /sticky top-18 z-30 bg-white lg:static/);
  const dentro = busca.slice(i, busca.indexOf('data-testid="linha-contagem"'));
  assert.match(dentro, /<BarraPilulas/);
});

test("a linha da contagem NÃO está dentro do trecho preso (rola por baixo)", () => {
  const preso = busca.slice(busca.indexOf('data-testid="busca-topo-fixo"'), busca.indexOf("</BarraPilulas>") > 0 ? busca.indexOf("</BarraPilulas>") : busca.indexOf('/>\n      </div>\n      </div>'));
  assert.doesNotMatch(preso, /linha-contagem/);
});

test("o painel aberto numa faixa presa não passa da tela: altura máxima com rolagem no celular", () => {
  assert.match(barra, /max-h-\[calc\(100dvh-13rem\)\] overflow-y-auto/);
});
