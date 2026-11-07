import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Passada 65 (07/11, 390 px): no diálogo "Agendar visita", o botão "+ Outro horário" mede 20 px — abaixo de 44 px de toque.
const src = readFileSync(new URL("./visita-video.tsx", import.meta.url), "utf8");

test('"+ Outro horário" tem 44 px de toque (min-h-11) e continua alinhado à esquerda', () => {
  assert.match(src, /className="inline-flex min-h-11 items-center self-start text-sm font-medium text-forest hover:underline"[\s\S]{0,260}\+ Outro horário/);
});
