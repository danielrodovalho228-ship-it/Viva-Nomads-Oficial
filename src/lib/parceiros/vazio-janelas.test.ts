/*
  Agenda do parceiro sem janela: o texto diz o efeito real (a agenda não filtra) e o que fazer, no lugar de
  "Nenhuma janela ainda.". O teste prende o texto à regra de horarioNaAgenda.
  Roda: node --test src/lib/parceiros/vazio-janelas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { horarioNaAgenda } from "./pedido.ts";

const PAINEL = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx", import.meta.url), "utf8");

test("a regra que o texto descreve: sem janela, vale qualquer horário futuro fora dos bloqueios", () => {
  const agora = new Date("2026-11-02T12:00:00Z");
  assert.equal(horarioNaAgenda("2026-11-04T06:00:00Z", [], [], agora), true);
  assert.equal(horarioNaAgenda("2026-11-01T12:00:00Z", [], [], agora), false);
  assert.equal(horarioNaAgenda("2026-11-04T06:00:00Z", [], [{ inicio: "2026-11-04T00:00:00Z", fim: "2026-11-05T00:00:00Z" }], agora), false);
});

test("a lista vazia de janelas explica o efeito e o próximo passo, com testid", () => {
  assert.doesNotMatch(PAINEL, />Nenhuma janela ainda\.</);
  assert.match(PAINEL, /data-testid="parceiro-janelas-vazio"/);
  assert.match(PAINEL, /os pedidos aceitam qualquer horário futuro fora dos bloqueios/);
  assert.match(PAINEL, /Adicione abaixo os dias e horários em que você atende/);
});
