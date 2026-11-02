/* Roda: node --test "src/app/(dashboard)/dashboard/carteira/link-alvo.test.ts" — varredura 01/11 (Pista A): na Carteira o link solto "Ver pedidos compatíveis" tinha 20 px de altura no celular; ganha a área de 44 px de .alvo-toque sem mudar o visual. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./carteira-client.tsx", import.meta.url), "utf8");

test("Carteira: link com alvo de 44 px", () => {
  assert.match(src, /className="alvo-toque font-medium text-forest underline"\n\s*data-testid="carteira-pedidos-compativeis"/);
  assert.doesNotMatch(src, /className="font-medium text-forest underline"\n\s*data-testid="carteira-pedidos-compativeis"/);
});
