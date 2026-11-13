import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync(new URL("./property-card.tsx", import.meta.url), "utf8");

// E416 (05/11): a patinha virou o selo "Aceita pets" sobre a foto (ícone + texto visível), entre os selos empilhados.
const selos = readFileSync(new URL("./property/selos-foto.tsx", import.meta.url), "utf8");

test("cartão do anúncio mostra a patinha só quando o imóvel aceita pet (ordem 022afabb, item 3)", () => {
  // E811: o cartão lê a fonte única dos selos (a mesma da página).
  assert.match(cartao, /\.\.\.simbolosDoImovel\(property\)/);
  assert.match(readFileSync(new URL("../lib/cartao-selos-foto.ts", import.meta.url), "utf8"), /pets: p\.petsAllowed === true/);
  assert.match(selos, /pets: PawPrint/);
});

test("a patinha tem o texto completo (aria-label e title): 'Aceita pets' (E626: só símbolo na pílula)", () => {
  assert.match(selos, /role="img" aria-label=\{s\.rotulo\} title=\{s\.rotulo\}/);
  assert.match(selos, /pets: PawPrint/);
});
