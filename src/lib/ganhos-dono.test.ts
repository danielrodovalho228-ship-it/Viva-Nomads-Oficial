/* Roda: node --test src/lib/ganhos-dono.test.ts — E176: subaba "Ganhos" de Contratos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ganhosDoDono } from "./ganhos-dono.ts";
import type { ItemCarteira } from "./carteira-dono.ts";

const item = (p: Partial<ItemCarteira>): ItemCarteira => ({
  propertyId: "p", titulo: "Studio", bairro: "Centro", situacao: "vago", valorMensal: 0, inicio: null, fim: null, diasAteFim: null, morador: null, contratoId: null, contratoNumero: null, ...p,
});

test("soma o valor mensal em vigência e o contratado a começar; vago fica de fora", () => {
  const g = ganhosDoDono([
    item({ propertyId: "a", situacao: "ocupado", valorMensal: 3200, inicio: "2026-09-01", contratoId: "c1" }),
    item({ propertyId: "b", situacao: "reservado", valorMensal: 2800, inicio: "2026-11-10", contratoId: "c2" }),
    item({ propertyId: "c", situacao: "vago" }),
  ]);
  assert.equal(g.vigencia, 3200);
  assert.equal(g.aComecar, 2800);
  assert.deepEqual(g.linhas.map((l) => l.propertyId), ["a", "b"]);
});

test("sem contrato: lista vazia (a tela mostra o estado vazio)", () => {
  assert.deepEqual(ganhosDoDono([item({})]), { vigencia: 0, aComecar: 0, linhas: [] });
});
