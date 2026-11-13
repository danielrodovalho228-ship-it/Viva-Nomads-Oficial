/*
  E884: na home, Esc não fechava as sugestões da busca (CityAutocomplete só fechava no clique fora ou na escolha).
  Roda: node --test src/lib/busca/sugestoes-teclado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E884: Esc fecha as sugestões abertas; com elas fechadas, Esc não faz nada", async () => {
  const { abertoAposTecla } = await import("./sugestoes-teclado.ts");
  assert.equal(abertoAposTecla("Escape", true), false);
  assert.equal(abertoAposTecla("Escape", false), false);
  assert.equal(abertoAposTecla("a", true), true);
  assert.equal(abertoAposTecla("ArrowDown", false), false);
});

test("E884: o CityAutocomplete (usado pela busca da home) liga o onKeyDown do campo à regra", () => {
  const src = readFileSync(new URL("../../components/city-autocomplete.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../../components/home/busca-principal.tsx", import.meta.url), "utf8");
  assert.match(home, /<CityAutocomplete/);
  assert.match(src, /import \{ abertoAposTecla \} from "@\/lib\/busca\/sugestoes-teclado"/);
  const input = src.slice(src.indexOf("<input"), src.indexOf("/>", src.indexOf("<input")));
  assert.match(input, /onKeyDown=\{/);
  assert.match(input, /abertoAposTecla\(e\.key, open\)/);
});
