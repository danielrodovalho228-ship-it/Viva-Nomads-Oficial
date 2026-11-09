import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Lab t112: nenhuma imagem decorativa se repete na mesma página pública. */
test("t112: /para-proprietarios usa cada imagem decorativa uma só vez", () => {
  const src = readFileSync("src/app/(public)/para-proprietarios/page.tsx", "utf8");
  const usos = [...src.matchAll(/\/images\/unicas\/[\w-]+\.webp/g)].map((m) => m[0]);
  const repetidas = usos.filter((u, i) => usos.indexOf(u) !== i);
  assert.deepEqual(repetidas, []);
});
