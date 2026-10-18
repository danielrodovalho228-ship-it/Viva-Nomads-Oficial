import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorDia, diaBrasilia, diasDoItem, filtrarPorImovel, gradeDoMes, horaBrasilia, moverMes, type ItemAgenda } from "./agenda.ts";

const item = (p: Partial<ItemAgenda>): ItemAgenda => ({ id: "x", tipo: "visita", propertyId: "a", imovel: "Studio", quando: "2026-10-20", href: null, ...p });

test("p23 agenda — o dia é o de Brasília (visita às 22h30 de Brasília não vira o dia seguinte)", () => {
  // 21/10 01:30 UTC = 20/10 22:30 em Brasília.
  assert.equal(diaBrasilia("2026-10-21T01:30:00Z"), "2026-10-20");
  assert.equal(horaBrasilia("2026-10-21T01:30:00Z"), "22:30");
  // Data pura (entrada/saída/bloqueio) não muda de dia por fuso.
  assert.equal(diaBrasilia("2026-10-20"), "2026-10-20");
  assert.equal(horaBrasilia("2026-10-20"), null);
});

test("p23 agenda — bloqueio ocupa todos os dias; filtro por imóvel", () => {
  assert.deepEqual(diasDoItem(item({ tipo: "bloqueio", quando: "2026-10-30", ate: "2026-11-02" })), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  const itens = [item({ id: "1", propertyId: "a" }), item({ id: "2", propertyId: "b" })];
  assert.deepEqual(filtrarPorImovel(itens, "b").map((i) => i.id), ["2"]);
  assert.equal(filtrarPorImovel(itens, null).length, 2);
});

test("p23 agenda — no dia: saída, entrada, visitas pela hora, bloqueio", () => {
  const dia = agruparPorDia([
    item({ id: "v2", tipo: "visita", quando: "2026-10-20T18:00:00Z" }),
    item({ id: "b", tipo: "bloqueio", quando: "2026-10-20", ate: "2026-10-20" }),
    item({ id: "v1", tipo: "visita", quando: "2026-10-20T13:00:00Z" }),
    item({ id: "e", tipo: "entrada", quando: "2026-10-20" }),
    item({ id: "s", tipo: "saida", quando: "2026-10-20" }),
  ]).get("2026-10-20")!;
  assert.deepEqual(dia.map((i) => i.id), ["s", "e", "v1", "v2", "b"]);
});

test("p23 agenda — grade do mês de domingo a sábado; navegação entre meses", () => {
  const out = gradeDoMes(2026, 10); // 01/10/2026 é quinta
  assert.equal(out[0][0].dia, "2026-09-27");
  assert.equal(out[0][4].dia, "2026-10-01");
  assert.ok(out.every((s) => s.length === 7));
  assert.ok(out.flat().filter((d) => d.doMes).length === 31);
  assert.deepEqual(moverMes(2026, 12, 1), { ano: 2027, mes: 1 });
  assert.deepEqual(moverMes(2026, 1, -1), { ano: 2025, mes: 12 });
});
