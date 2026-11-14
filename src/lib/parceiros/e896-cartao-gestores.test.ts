/*
  E896 (prova L-004, PROVADO): em /parceiros o cartão "Gestores e administradoras" ficava SEM saída — o único link levava a
  /precos#plano-gestor e some com a página de preços suspensa (PRECOS_VISIVEL desligada) —, embora a introdução prometa
  página própria para gestores. Agora o cartão sempre tem uma saída: com os preços visíveis, "Ver o Plano Gestor"; suspensos,
  a escada de taxas com o Plano Gestor em /para-proprietarios#taxa.
  Roda: node --test src/lib/parceiros/e896-cartao-gestores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linksDoCartaoGestores } from "./tipos-parceria.ts";
import { ehPortaDePrecos } from "../../config/precos-visivel.ts";

const ler = (p: string) => readFileSync(new URL(`../../app/(public)/${p}`, import.meta.url), "utf8");

test("E896: preços suspensos → o cartão leva à escada de taxas com o Plano Gestor (/para-proprietarios#taxa)", () => {
  const links = linksDoCartaoGestores(false);
  assert.equal(links.length, 1);
  assert.equal(links[0].href, "/para-proprietarios#taxa");
  assert.ok(!ehPortaDePrecos(links[0].href));
  assert.match(links[0].rotulo, /Plano Gestor/);
});

test("E896: preços visíveis → segue 'Ver o Plano Gestor' em /precos#plano-gestor (E302)", () => {
  assert.deepEqual(linksDoCartaoGestores(true), [{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }]);
});

test("E896: /parceiros usa a função e /para-proprietarios tem a âncora #taxa no texto da escada", () => {
  const parceiros = ler("parceiros/page.tsx");
  assert.match(parceiros, /id: "gestores"[\s\S]{0,400}links: linksDoCartaoGestores\(PRECOS_VISIVEL\)/);
  const prop = ler("para-proprietarios/page.tsx");
  assert.match(prop, /id="taxa"[^>]*data-testid="anunciar-taxa"|data-testid="anunciar-taxa"[^>]*id="taxa"/);
  assert.match(prop, /\{FRASE_ESCADA_TAXAS\}/);
});

test("E896: nenhum cartão de /parceiros fica sem saída quando os preços estão suspensos", () => {
  const parceiros = ler("parceiros/page.tsx");
  const cards = parceiros.slice(parceiros.indexOf("const CARDS = ["), parceiros.indexOf("];", parceiros.indexOf("const CARDS = [")));
  // Cada cartão declara links; só o dos gestores dependia da página de preços, e agora tem saída nos dois estados.
  assert.doesNotMatch(cards, /comPortasDePrecos\(/);
});
