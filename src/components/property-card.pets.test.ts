import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync(new URL("./property-card.tsx", import.meta.url), "utf8");

test("cartão do anúncio mostra a patinha só quando o imóvel aceita pet (ordem 022afabb, item 3)", () => {
  assert.match(cartao, /property\.petsAllowed\s*&&/);
  assert.match(cartao, /Aceita pet/);
});

test("a patinha tem texto para leitor de tela (não só ícone)", () => {
  assert.match(cartao, /aria-label="Aceita pet"|<span className="sr-only">Aceita pet/);
});
