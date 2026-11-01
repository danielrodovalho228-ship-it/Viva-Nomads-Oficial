import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E347 — o diálogo da visita tem o X no padrão do lightbox, sem tirar Voltar e o clique fora", () => {
  const v = readFileSync(new URL("./visita-video.tsx", import.meta.url), "utf8");
  assert.match(v, /<IconButton onClick=\{fechar\} label="Fechar" icon=\{X\} iconClassName="h-6 w-6"/);
  assert.match(v, /data-testid=\{`\$\{t\.prefixo\}-fechar`\}/);
  assert.match(v, /onClick=\{\(\) => fechar\(\)\}/, "clique fora continua fechando");
  const g = readFileSync(new URL("../property-gallery.tsx", import.meta.url), "utf8");
  assert.match(g, /<IconButton onClick=\{onClose\} label="Fechar" icon=\{X\} iconClassName="h-6 w-6"/, "o mesmo padrão do lightbox");
});
