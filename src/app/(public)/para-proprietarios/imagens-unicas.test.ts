import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Laboratório t112: nenhuma imagem decorativa pode aparecer duas vezes na mesma página pública.
// Aqui a guarda estática: cada /images/unicas/*.webp é citada uma única vez em /para-proprietarios.
test("/para-proprietarios não repete imagem decorativa", () => {
  const fonte = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  const contagem = new Map<string, number>();
  for (const [, caminho] of fonte.matchAll(/\/images\/unicas\/[\w-]+\.webp/g).map((m) => [m[0], m[0]] as const)) {
    contagem.set(caminho, (contagem.get(caminho) ?? 0) + 1);
  }
  const repetidas = [...contagem].filter(([, n]) => n > 1).map(([c]) => c);
  assert.deepEqual(repetidas, []);
});
