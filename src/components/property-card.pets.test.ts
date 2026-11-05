import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync(new URL("./property-card.tsx", import.meta.url), "utf8");

// E416 (05/11): a patinha virou o selo "Aceita pets" sobre a foto (ícone + texto visível), entre os selos empilhados.
const selos = readFileSync(new URL("./property/selos-foto.tsx", import.meta.url), "utf8");

test("cartão do anúncio mostra a patinha só quando o imóvel aceita pet (ordem 022afabb, item 3)", () => {
  assert.match(cartao, /pets: !!property\.petsAllowed/);
  assert.match(selos, /pets: PawPrint/);
});

test("a patinha tem texto (não só ícone): o selo escreve 'Aceita pets'", () => {
  assert.match(selos, /<span className="truncate" title=\{s\.rotulo\}>\s*\{s\.rotulo\.split\(" · "\)\[0\]\}/);
  assert.match(selos, /<Icone className="h-3 w-3 shrink-0[^"]*" aria-hidden \/>/);
});
