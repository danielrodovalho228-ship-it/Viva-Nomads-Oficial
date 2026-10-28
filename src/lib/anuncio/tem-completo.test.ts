/* Roda: node --test src/lib/anuncio/tem-completo.test.ts — E191 (o "Tem" do anúncio é a mesma lista do diálogo). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agruparComodidades, comodidadesPrincipais } from "./comodidades.ts";
import type { Property } from "../types.ts";

test("ube-006 (7 comodidades): o diálogo tem 7 e o resumo de 6 deixava 'Vaga de garagem' de fora", () => {
  const p = { amenities: ["Mobiliado completo", "Ar-condicionado", "Máquina de lavar", "Cozinha equipada", "Smart TV", "Wi-Fi", "Vaga de garagem"], propertyType: "apartamento" } as unknown as Property;
  const a = agruparComodidades(p);
  assert.equal(a.total, 7);
  assert.ok(!comodidadesPrincipais(a).includes("Vaga de garagem"));
  assert.ok(a.grupos.flatMap((g) => g.items).includes("Vaga de garagem"));
});

test("com 'Tem' × 'Não tem', o 'Tem' lista todas as comodidades (as do diálogo)", () => {
  const tela = readFileSync("src/components/property/amenities-grid.tsx", "utf8");
  assert.match(tela, /const principais = comTemNaoTem \? agrupadas\.grupos\.flatMap\(\(g\) => g\.items\) : comodidadesPrincipais\(agrupadas\);/);
});
