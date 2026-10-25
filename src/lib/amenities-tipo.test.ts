/* Roda: node --test src/lib/amenities-tipo.test.ts — E111-A: comodidades conforme o tipo do imóvel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AMENITY_GROUPS, AMENITY_LABEL, comodidadeValeParaTipo, comodidadesDoTipo, rotulosQueValemParaTipo } from "./amenities.ts";

const chaves = (tipo: string | null) => comodidadesDoTipo(tipo).flatMap((g) => g.items.map((i) => i.key));
const todas = AMENITY_GROUPS.flatMap((g) => g.items.map((i) => i.key));
const grupo = (tipo: string, cat: string) => comodidadesDoTipo(tipo).find((g) => g.category === cat);
const PREDIO = ["sala_reuniao", "coworking", "cabine_chamadas", "academia", "portaria_24h", "elevador", "salao_festas", "lavanderia", "bicicletario"];

test("prédio (apartamento, studio, loft, cobertura, flat) e quarto: tudo, com 'No prédio' e 'Prédio / condomínio'", () => {
  for (const t of ["apartamento", "studio", "loft", "cobertura", "flat", "quarto", "Apartamento"]) {
    assert.deepEqual(chaves(t), todas, t);
    assert.equal(grupo(t, "trabalho")!.titulo, "No prédio");
    assert.equal(grupo(t, "edificio")!.label, "Prédio / condomínio");
  }
});

test("casa de condomínio: tudo menos elevador; 'No condomínio' e 'Condomínio'", () => {
  assert.deepEqual(chaves("casa_condominio"), todas.filter((k) => k !== "elevador"));
  assert.equal(grupo("casa_condominio", "trabalho")!.titulo, "No condomínio");
  assert.equal(grupo("casa_condominio", "edificio")!.label, "Condomínio");
  assert.equal(comodidadeValeParaTipo("elevador", "Casa de condomínio"), false);
});

test("casa e chácara: sem itens de prédio; piscina, churrasqueira e vaga em 'Área externa e garagem'", () => {
  for (const t of ["casa", "chacara", "Chácara/Sítio"]) {
    const k = chaves(t);
    for (const p of PREDIO) assert.ok(!k.includes(p), `${t}: ${p}`);
    const ext = grupo(t, "edificio")!;
    assert.equal(ext.label, "Área externa e garagem");
    assert.deepEqual(ext.items.map((i) => i.key), ["piscina", "churrasqueira", "vaga_garagem"]);
    assert.ok(k.includes("home_office") && k.includes("ar_condicionado") && k.includes("extintor"), t);
  }
});

test("tipo não escolhido ou desconhecido: tudo, como hoje", () => {
  assert.deepEqual(chaves(null), todas);
  assert.deepEqual(chaves(""), todas);
  assert.deepEqual(chaves("barco"), todas);
});

test("troca de tipo preserva as chaves: a regra só decide o que aparece", () => {
  const marcadas = { elevador: true, piscina: true, ar_condicionado: true };
  const visiveis = (tipo: string) => Object.keys(marcadas).filter((k) => comodidadeValeParaTipo(k, tipo));
  assert.deepEqual(visiveis("apartamento"), ["elevador", "piscina", "ar_condicionado"]);
  assert.deepEqual(visiveis("chacara"), ["piscina", "ar_condicionado"]);
  assert.deepEqual(visiveis("apartamento"), ["elevador", "piscina", "ar_condicionado"], "voltou ao tipo: volta marcado");
  assert.deepEqual(Object.keys(marcadas), ["elevador", "piscina", "ar_condicionado"], "nada apagado");
});

test("anúncio público de chácara com 'Elevador' salvo não exibe o item (texto livre passa)", () => {
  const salvos = [AMENITY_LABEL.elevador, AMENITY_LABEL.portaria_24h, AMENITY_LABEL.piscina, "Quintal"];
  assert.deepEqual(rotulosQueValemParaTipo(salvos, "chacara"), [AMENITY_LABEL.piscina, "Quintal"]);
  assert.deepEqual(rotulosQueValemParaTipo(salvos, "apartamento"), salvos);
});
