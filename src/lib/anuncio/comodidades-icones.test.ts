import test from "node:test";
import assert from "node:assert/strict";
import { Check, Wifi, AirVent, Car } from "lucide-react";
import { iconeDaComodidade, ICONE_POR_CHAVE } from "./comodidades-icones.ts";
import { AMENITY_GROUPS } from "../amenities.ts";
import { LIMITE_PRINCIPAIS } from "./comodidades.ts";

test("toda comodidade do catálogo tem ícone próprio (não o genérico)", () => {
  for (const g of AMENITY_GROUPS) for (const it of g.items) {
    assert.ok(ICONE_POR_CHAVE[it.key], `sem ícone: ${it.key}`);
    assert.notEqual(iconeDaComodidade(it.label), Check, it.label);
  }
});

test("texto livre usa palavra-chave; sem par cai no ícone padrão", () => {
  assert.equal(iconeDaComodidade("Wi-Fi 500 mega"), Wifi);
  assert.equal(iconeDaComodidade("Ar-condicionado split"), AirVent);
  assert.equal(iconeDaComodidade("Vaga de garagem"), Car);
  assert.equal(iconeDaComodidade("Algo inédito"), Check);
});

test("as principais na página são em número par", () => {
  assert.equal(LIMITE_PRINCIPAIS % 2, 0);
});
