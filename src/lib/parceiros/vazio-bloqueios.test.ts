/*
  Agenda do parceiro sem bloqueio: o texto diz para que serve o bloqueio, no lugar de só "Nenhum bloqueio.".
  O teste prende o texto à regra de horarioNaAgenda (horário dentro de um bloqueio nunca vale).
  Roda: node --test src/lib/parceiros/vazio-bloqueios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { horarioNaAgenda } from "./pedido.ts";

const PAINEL = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx", import.meta.url), "utf8");

test("a regra que o texto descreve: dentro de um bloqueio, nenhum horário vale (com ou sem janela)", () => {
  const agora = new Date("2026-11-02T12:00:00Z");
  const bloqueio = [{ inicio: "2026-11-10T00:00:00Z", fim: "2026-11-20T00:00:00Z" }];
  assert.equal(horarioNaAgenda("2026-11-12T13:00:00Z", [], bloqueio, agora), false);
  assert.equal(horarioNaAgenda("2026-11-12T13:00:00Z", [{ dia: 4, inicio: "08:00", fim: "18:00" }], bloqueio, agora), false);
  assert.equal(horarioNaAgenda("2026-11-21T13:00:00Z", [], bloqueio, agora), true);
});

test("a lista vazia de bloqueios explica o uso, com testid, e não só 'Nenhum bloqueio.'", () => {
  assert.doesNotMatch(PAINEL, />Nenhum bloqueio\.</);
  assert.match(PAINEL, /data-testid="parceiro-bloqueios-vazio"/);
  assert.match(PAINEL, /Bloqueie abaixo as datas em que você não atende \(férias, por exemplo\): nelas, nenhum pedido aceita horário\./);
});
