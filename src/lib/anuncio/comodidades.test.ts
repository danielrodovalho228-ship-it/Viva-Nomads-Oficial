import test from "node:test";
import assert from "node:assert/strict";
import { agruparComodidades, comodidadesPrincipais, LIMITE_PRINCIPAIS } from "./comodidades.ts";
import type { Property } from "../types.ts";

const com = (p: Partial<Property>): Property => ({ amenities: [], ...p }) as Property;

test("sem comodidade nenhuma: grupos vazios e total 0", () => {
  const g = agruparComodidades(com({}));
  assert.deepEqual(g.grupos, []);
  assert.equal(g.total, 0);
  assert.deepEqual(comodidadesPrincipais(g), []);
});

test("ordena as categorias conhecidas e deixa as desconhecidas por último", () => {
  const g = agruparComodidades(
    com({
      amenityGroups: [
        { category: "seguranca", items: ["Câmera"] },
        { category: "outra" as never, items: ["X"] },
        { category: "trabalho", items: ["Wi-Fi", "Mesa"] },
      ],
    }),
  );
  assert.deepEqual(g.grupos.map((x) => x.category), ["trabalho", "seguranca", "outra"]);
  assert.equal(g.total, 4);
});

test("principais: no máximo 5, na ordem das categorias", () => {
  const g = agruparComodidades(
    com({
      amenityGroups: [
        { category: "cozinha", items: ["Fogão", "Geladeira", "Micro-ondas"] },
        { category: "trabalho", items: ["Wi-Fi", "Mesa", "Cadeira"] },
      ],
    }),
  );
  const p = comodidadesPrincipais(g);
  assert.equal(LIMITE_PRINCIPAIS, 5);
  assert.equal(p.length, 5);
  assert.deepEqual(p.slice(0, 3), ["Wi-Fi", "Mesa", "Cadeira"]);
  assert.equal(g.total, 6);
});

test("lista plana vira um grupo; até 5 itens não precisa de 'Ver todas'", () => {
  const g = agruparComodidades(com({ amenities: ["A", "B", "C"] }));
  assert.equal(g.total, 3);
  assert.equal(comodidadesPrincipais(g).length, 3);
  assert.equal(g.precisaVerTodas, false);
  const g6 = agruparComodidades(com({ amenities: ["A", "B", "C", "D", "E", "F"] }));
  assert.equal(g6.precisaVerTodas, true);
});

test("itens repetidos ou em branco não contam", () => {
  const g = agruparComodidades(com({ amenities: ["Wi-Fi", " wi-fi ", "", "Ar"] }));
  assert.equal(g.total, 2);
});
