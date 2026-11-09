import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/property/bom-saber.tsx", "utf8");

// Varredura 08/11 (390 e 1280 px, /imoveis/[id]): a linha-resumo do "Bom saber" era cortada com "…" ("Sem câmeras no
// interior (declarado pelo…", "Urgente com solução provisória em até 24…"). É a frase que diz o que o morador vai
// encontrar; passa a quebrar em até 2 linhas, sem reticências.
test("a linha-resumo do Bom saber quebra em até 2 linhas, não é cortada com reticências", () => {
  const linha = fonte.split("\n").find((l) => l.includes("{l.resumo}")) ?? "";
  assert.match(linha, /line-clamp-2/);
  assert.doesNotMatch(linha, /\btruncate\b/);
});
