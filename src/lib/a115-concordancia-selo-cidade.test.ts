/*
  A-115 (RELATORIO-021) — "Os que têm o selo Pronto para Morar são mobiliado e equipado…" (plural + resumo no singular).
  Roda: node --test src/lib/a115-concordancia-selo-cidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELOS } from "../config/selos.ts";

const pagina = readFileSync(new URL("../app/(public)/cidades/[cidade]/page.tsx", import.meta.url), "utf8");
// Texto como o leitor vê: tira as quebras de JSX e o {" "}.
const plano = pagina.replace(/\{" "\}/g, " ").replace(/\s+/g, " ");

test("o resumo do selo (singular) entra numa frase no singular", () => {
  assert.match(SELOS.prontoParaMorar.resumo, /^mobiliado e equipado/);
  assert.doesNotMatch(plano, /são \{SELOS\.prontoParaMorar\.resumo\}/);
  assert.match(plano, /marca o imóvel \{SELOS\.prontoParaMorar\.resumo\}/);
});
