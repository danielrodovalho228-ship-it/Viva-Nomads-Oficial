import test from "node:test";
import assert from "node:assert/strict";
import { comodidadesQueNaoTem, ESPERADAS } from "./nao-tem.ts";
import { iconeDaComodidade } from "./comodidades-icones.ts";
import { Check } from "lucide-react";
import type { Property } from "../types.ts";

const imovel = (amenities: string[]) => ({ amenities } as unknown as Property);

test("sem comodidade cadastrada não afirma que não tem nada", () => {
  assert.deepEqual(comodidadesQueNaoTem(imovel([])), []);
});

test("lista só o que não está marcado, na ordem fixa", () => {
  const r = comodidadesQueNaoTem(imovel(["Lava-louças", "Internet fibra de alta velocidade", "Vaga de garagem", "Cozinha equipada"]));
  assert.deepEqual(r, ["TV", "Elevador", "Máquina de lavar", "Ar-condicionado"]);
});

test("imóvel com tudo marcado não tem bloco 'Não tem'", () => {
  const todos = ["Lava-louças", "TV", "Elevador", "Máquina de lavar", "Ar-condicionado", "Wi-Fi", "Vaga de garagem"];
  assert.deepEqual(comodidadesQueNaoTem(imovel(todos)), []);
});

test("todo item esperado tem ícone próprio", () => {
  for (const e of ESPERADAS) assert.notEqual(iconeDaComodidade(e.rotulo), Check, e.rotulo);
});

test("E753: 'Wi-Fi' nunca aparece em 'Não tem' — a internet não é comodidade marcada e o anúncio a afirma pelo espaço de trabalho", () => {
  assert.ok(!ESPERADAS.some((e) => /wi-?fi|internet/i.test(e.rotulo)), "a lista fixa não tem Wi-Fi");
  // ube-003: sem nenhum item de internet nas comodidades, mas com internet declarada (trabalho remoto)
  const ube003 = { amenities: ["Mobiliado completo", "Máquina de lavar", "Cozinha equipada", "Aceita pets", "Vaga de garagem"], internetTier: "trabalho_remoto" } as unknown as Property;
  const r = comodidadesQueNaoTem(ube003);
  assert.ok(!r.includes("Wi-Fi"), `não tem: ${r.join(", ")}`);
  assert.deepEqual(r, ["Lava-louças", "TV", "Elevador", "Ar-condicionado"]);
});
