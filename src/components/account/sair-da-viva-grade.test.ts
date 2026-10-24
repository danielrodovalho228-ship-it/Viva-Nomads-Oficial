import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab t119: grades de cards nas telas logadas têm 1 coluna ou número par — nunca 3.
test("Sair da Viva: os 3 cartões não ficam em grade de 3 colunas no desktop", () => {
  const f = readFileSync("src/components/account/sair-da-viva.tsx", "utf8");
  const lista = f.match(/<ul className="([^"]*)" data-testid="saida-cartoes">/);
  assert.ok(lista, "lista de cartões encontrada");
  assert.doesNotMatch(lista[1], /grid-cols-3/);
});
