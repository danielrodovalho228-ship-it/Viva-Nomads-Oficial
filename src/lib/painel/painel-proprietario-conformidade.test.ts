import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../components/painel/inicio-dono.tsx", import.meta.url), "utf8");

test("painel-proprietario: passos com os três estados do mockup (Concluído · Em andamento · Pendente)", () => {
  assert.match(src, /ROTULO_ESTADO_PASSO = \{ feito: "Concluído", agora: "Em andamento", depois: "Pendente" \}/);
  assert.match(src, /\{ROTULO_ESTADO_PASSO\[estado\]\}/);
  // O ícone e o rótulo saem do MESMO estado (o primeiro não feito é o atual).
  assert.match(src, /<IconePasso estado=\{estado\} \/>/);
});
