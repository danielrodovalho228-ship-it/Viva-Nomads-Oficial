import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../components/property/visita-video.tsx", import.meta.url), "utf8");

test("E320: anúncio de exemplo — a folha explica a visita num anúncio real e leva aos imóveis reais", () => {
  assert.match(src, /function ExemploVisita/);
  assert.match(src, /href="\/buscar"[^>]*data-testid=\{`\$\{prefixo\}-ver-reais`\}/);
  assert.match(src, /o proprietário confirma um deles e envia o link da chamada/);
  // Antes do pedido (formulário) e depois (pedido não enviado): os dois estados usam o bloco.
  assert.equal((src.match(/<ExemploVisita /g) ?? []).length, 2);
  assert.match(src, /\{demo \|\| exemplo \? \(\s*<ExemploVisita/);
});

test("E320: anúncio real segue com o formulário e a confirmação de sempre", () => {
  assert.match(src, /data-testid=\{`\$\{t\.prefixo\}-ok`\}/);
  assert.match(src, /data-testid=\{`\$\{t\.prefixo\}-horario-\$\{i\}`\}/);
});
