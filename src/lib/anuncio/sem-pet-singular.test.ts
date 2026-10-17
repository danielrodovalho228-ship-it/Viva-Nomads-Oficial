import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// D14 (ordem dd15064d): o rótulo público é sempre "Aceita pets".
const ARQUIVOS = [
  "src/components/property-card.tsx",
  "src/components/busca/card-pin-mapa.tsx",
  "src/lib/busca/comparar.ts",
  "src/components/property/importar-anuncio.tsx",
  "src/app/(public)/buscar/search-client.tsx",
];

test("nenhum rótulo diz 'Aceita pet' no singular", () => {
  for (const f of ARQUIVOS) {
    const texto = readFileSync(f, "utf8");
    assert.doesNotMatch(texto, /Aceita pet(?!s)/, f);
  }
});
