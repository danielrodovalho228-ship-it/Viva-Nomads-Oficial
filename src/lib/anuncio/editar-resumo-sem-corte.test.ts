import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", "utf8");

// Varredura 08/11 (390 px, /dashboard/imoveis/[id]/editar): a linha-resumo de cada seção do acordeão ("aceita pets · não
// fumantes · …", "Ainda não preenchida — o morad…", "Nenhum detalhe opcional ligado") era cortada com "…". Quebra em até 2 linhas.
test("a linha-resumo das seções do editor quebra em até 2 linhas, sem reticências", () => {
  const linha = fonte.split("\n").find((l) => l.includes("{summary}")) ?? "";
  assert.match(linha, /line-clamp-2/);
  assert.doesNotMatch(linha, /\btruncate\b/);
});
