import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/app/(public)/pedidos/novo/page.tsx", "utf8");

// Varredura 08/11 (390 px, /pedidos/novo): os botões de marca ("Mobiliado completo") e de internet ("300 Mbps") eram
// cortados com "…" no botão de 48 px. O rótulo quebra em até 2 linhas, centrado, sem reticências.
test("o rótulo do BotaoMarca quebra em até 2 linhas, não é cortado com reticências", () => {
  const i = fonte.indexOf("function BotaoMarca");
  assert.ok(i > 0);
  const corpo = fonte.slice(i, i + 1500);
  assert.match(corpo, /<span className="line-clamp-2[^"]*leading-tight[^"]*">\{children\}<\/span>/);
  assert.doesNotMatch(corpo, /<span className="truncate">/);
});
