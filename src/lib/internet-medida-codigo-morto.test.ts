/*
  Varredura de erros, rodada 22: medidaPublica e medidasPublicas eram código morto (sem chamador) e saíram. A página do
  imóvel e a busca leem a view internet_medida_publica em src/lib/data/properties.ts — a fonte que vale.
  Roda: node --test src/lib/internet-medida-codigo-morto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("medidaPublica e medidasPublicas não voltam; a leitura pública segue em properties.ts", () => {
  assert.doesNotMatch(ler("src/lib/internet-medida-servidor.ts"), /export async function medidas?Publicas?\(/);
  assert.match(ler("src/lib/data/properties.ts"), /from\("internet_medida_publica"\)/);
});
