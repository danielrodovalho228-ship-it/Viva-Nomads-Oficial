import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensSintese } from "../cartao-sintese.ts";

const fonte = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
const corpo = (nome: string) => fonte.slice(fonte.indexOf(`export async function ${nome}(`), fonte.indexOf("\n}\n", fonte.indexOf(`export async function ${nome}(`)));

test("E416 — toda lista pública de cartões anexa o nível (busca/início/cidades e página do proprietário)", () => {
  assert.match(corpo("listProperties"), /await attachNivel\(supabase, mapped\);/);
  assert.match(corpo("listPropertiesDoProprietario"), /await attachNivel\(supabase, mapped\);/);
  assert.match(corpo("listPropertiesDoProprietario"), /await attachPrecoJusto\(supabase, mapped\);/);
  assert.match(corpo("listPropertiesByCity"), /await listProperties\(\)/);
});

test("E416 — com nível, a linha-síntese do cartão abre com ele; em adequação não aparece", () => {
  assert.equal(itensSintese({ nivel: "conforto", bedrooms: 2 })[0]?.texto, "Conforto");
  assert.equal(itensSintese({ nivel: "premium", nivelVistoriado: true })[0]?.texto, "Premium · vistoriado");
  assert.equal(itensSintese({ nivel: "em_adequacao", bedrooms: 1 })[0]?.chave, "quartos");
});
