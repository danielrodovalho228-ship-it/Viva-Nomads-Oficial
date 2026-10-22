import { test } from "node:test";
import assert from "node:assert/strict";
import { servicosPorPerto, tipoServico } from "./proximidades.ts";

test("adendo 37: ônibus, mercado e farmácia — o mais perto, sem o nome do lugar", () => {
  const lista = [
    { category: "transporte" as const, name: "Parada Av. Pará", note: "6 min a pé" },
    { category: "transporte" as const, name: "Parada Rua X", note: "3 min a pé" },
    { category: "mercado" as const, name: "Supermercado Bretas", note: "12 min a pé" },
    { category: "saude" as const, name: "Drogasil", note: "8 min a pé" },
    { category: "saude" as const, name: "Hospital de Clínicas", note: "4 min de carro" },
  ];
  const s = servicosPorPerto(lista);
  assert.deepEqual(s.map((x) => x.texto), [
    "Ponto de ônibus mais perto: ~5 min a pé",
    "Mercado mais perto: ~10 min a pé",
    "Farmácia mais perto: ~10 min a pé",
  ]);
  for (const x of s) assert.doesNotMatch(x.texto, /Bretas|Drogasil|Parada/);
  assert.equal(tipoServico(lista[4]), null, "hospital não é farmácia");
});

test("serviço sem dado não aparece", () => {
  assert.deepEqual(servicosPorPerto([{ category: "mercado", name: "Mercado", note: undefined }]), []);
  assert.deepEqual(servicosPorPerto([]), []);
});
