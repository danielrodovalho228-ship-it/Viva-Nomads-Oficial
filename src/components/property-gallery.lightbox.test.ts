/*
  Lab 0ede9c2 (t140, 390 px): "Foto anterior" não era clicável — a foto (div `relative`, depois dos botões no DOM)
  ficava por cima do botão `absolute left-4`, e o clique estourava os 45 s. As setas precisam de z-index próprio.
  Roda: node --test src/components/property-gallery.lightbox.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./property-gallery.tsx", import.meta.url), "utf8");

function botao(label: string): string {
  const m = fonte.match(new RegExp(`<IconButton[^>]*label="${label}"[^>]*/>`));
  assert.ok(m, `botão "${label}" não encontrado`);
  return m[0];
}

test("setas do lightbox ficam acima da foto (z-10) — senão a anterior fica coberta a 390 px", () => {
  for (const label of ["Foto anterior", "Próxima foto"]) {
    assert.match(botao(label), /className="[^"]*\bz-10\b/, `${label} sem z-10`);
  }
});

test("o botão Fechar continua no cabeçalho do lightbox", () => {
  assert.match(botao("Fechar"), /onClick=\{onClose\}/);
});
