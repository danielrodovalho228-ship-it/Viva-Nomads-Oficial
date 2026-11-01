import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E302 (resíduo): /precos tem 'Ver o Plano Gestor' (âncora da própria página) junto do 'Falar sobre o Plano Gestor'", () => {
  const p = readFileSync(new URL("../../app/(public)/precos/page.tsx", import.meta.url), "utf8");
  assert.match(p, /<ButtonLink href="#plano-gestor" variant="tertiary"[^>]*data-testid="precos-ver-plano-gestor">\s*Ver o Plano Gestor/);
  assert.match(p, /id="plano-gestor"/);
  assert.match(p, /<PlanoGestorForm \/>/);
});
