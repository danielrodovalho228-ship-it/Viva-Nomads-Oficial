import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Passada 59 (07/11, 390 px): no filtro "Datas" da /buscar, os botões − e + de adultos e crianças medem 32 px.
const src = readFileSync(new URL("./search-client.tsx", import.meta.url), "utf8");
const trecho = src.slice(src.indexOf("function Stepper"));

test("Stepper do filtro: − e + com área de toque ampliada a 44 px", () => {
  const botoes = trecho.match(/className="alvo-toque grid h-8 w-8 place-items-center rounded-lg border border-line/g) ?? [];
  assert.equal(botoes.length, 2);
  assert.match(trecho, /aria-label=\{`Menos \$\{label\.toLowerCase\(\)\}`\}/);
  assert.match(trecho, /aria-label=\{`Mais \$\{label\.toLowerCase\(\)\}`\}/);
});
