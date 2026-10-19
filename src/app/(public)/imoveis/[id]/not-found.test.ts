import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Ordem 14715a8f: o 404 do imóvel serve <title> próprio já no HTML inicial (não o padrão da home). */
const naoEncontrado = readFileSync("src/app/(public)/imoveis/[id]/not-found.tsx", "utf8");

test("404 do imóvel exporta metadata com título próprio e sem herdar o robots da raiz", () => {
  assert.match(naoEncontrado, /export const metadata\b/);
  assert.match(naoEncontrado, /title:\s*"Página não encontrada"/);
  assert.match(naoEncontrado, /robots:\s*null/);
});
