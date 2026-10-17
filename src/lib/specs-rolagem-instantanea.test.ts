import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// O <html> usa scroll-smooth (src/app/layout.tsx): scrollIntoView sem behavior "instant" rola
// aos poucos, e um elementFromPoint logo em seguida vê o alvo fora da tela ("coberto").
// Foi a causa do t58 falhar em todos os labs ("alvo 2 coberto", lab 2073af3).
test("t58 mede cobertura só depois de rolar de forma instantânea", () => {
  const src = readFileSync(join(process.cwd(), "tests", "e2e", "specs", "t58-2fa-chave-texto.spec.ts"), "utf8");
  const chamadas = src.match(/scrollIntoView\(\{[^}]*\}\)/g) ?? [];
  assert.ok(chamadas.length >= 2);
  for (const c of chamadas) assert.match(c, /behavior:\s*"instant"/, c);
});
