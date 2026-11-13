/*
  E822 — o cartão "Gestores e administradoras" de /parceiros tem destino, com ou sem a página de preços.
  Roda: node --test src/lib/parceiros/e822-cartao-gestores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linksDoGestor } from "./cartao-gestores.ts";
import { comPortasDePrecos } from "../../config/precos-visivel.ts";

const pagina = readFileSync(new URL("../../app/(public)/parceiros/page.tsx", import.meta.url), "utf8");

test("com a página de preços SUSPENSA (como hoje), o cartão leva ao Plano Gestor de /para-proprietarios", () => {
  assert.deepEqual(comPortasDePrecos([{ href: "/precos#plano-gestor" }], false), [], "o link antigo some com a chave desligada (era o beco sem saída)");
  assert.deepEqual(linksDoGestor(false), [{ href: "/para-proprietarios#plano-gestor", rotulo: "Ver o Plano Gestor" }]);
});

test("com a página de preços ligada, segue para /precos#plano-gestor (E302)", () => {
  assert.deepEqual(linksDoGestor(true), [{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }]);
});

test("o destino existe: âncora #plano-gestor em /para-proprietarios, no parágrafo do Plano Gestor", () => {
  const pp = readFileSync(new URL("../../app/(public)/para-proprietarios/page.tsx", import.meta.url), "utf8");
  assert.match(pp, /<p id="plano-gestor"[^>]*data-testid="anunciar-taxa">/);
});

test("todos os cartões de categoria têm link (nenhum beco sem saída)", () => {
  assert.match(pagina, /id: "gestores",[\s\S]{0,800}links: linksDoGestor\(\) \}/);
  const cartoes = pagina.slice(pagina.indexOf("const CARDS = ["), pagina.indexOf("const PASSOS"));
  const ids = [...cartoes.matchAll(/\{ id: "([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 6, String(ids));
  // Um "links:" por cartão, nenhum vazio, e nenhum filtrado direto pela chave de preços (que podia esvaziá-lo).
  assert.equal((cartoes.match(/\blinks: /g) ?? []).length, ids.length, "um links: por cartão");
  assert.doesNotMatch(cartoes, /links: \[\s*\]/);
  assert.doesNotMatch(cartoes, /links: comPortasDePrecos\(/);
});
