/*
  Ordem de7b27fd (item 3): nenhuma imagem do site pode repetir outra. Compara o
  conteúdo (hash) de todos os arquivos de imagem em public/ e falha se houver duplicata.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EXT = /\.(webp|jpe?g|png|avif)$/i;
// Ícones do app (PWA/favicons) variam só no nome por exigência do manifesto; não são imagens de página.
const IGNORAR = /^public\/(icon-|apple-|favicon)/;

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : EXT.test(n) ? [p] : [];
  });
}

test("#de7b27fd: nenhuma imagem de public/ tem o mesmo conteúdo de outra", () => {
  const porHash = new Map<string, string[]>();
  for (const f of listar("public").filter((f) => !IGNORAR.test(f))) {
    const h = createHash("sha256").update(readFileSync(f)).digest("hex");
    porHash.set(h, [...(porHash.get(h) ?? []), f]);
  }
  const repetidas = [...porHash.values()].filter((v) => v.length > 1);
  assert.deepEqual(repetidas, [], `imagens duplicadas: ${JSON.stringify(repetidas)}`);
});
