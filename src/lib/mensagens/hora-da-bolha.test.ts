import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { horaDaBolha } from "./hora-da-bolha.ts";

/*
  E484 — bolhas de mensagem sem hora (rodada de simulação da conversa morador × proprietário, 02/11).
  Cada bolha mostra quando foi enviada, no fuso de Brasília: hoje "14:05", ontem "Ontem, 14:05", antes "02/11, 14:05"
  e de outro ano "02/11/2025, 14:05".
*/
const agora = new Date("2026-11-04T20:00:00Z"); // 17:00 em Brasília, 04/11/2026

test("mensagem de hoje mostra só a hora (fuso de Brasília)", () => {
  assert.equal(horaDaBolha("2026-11-04T17:05:00Z", agora), "14:05");
});

test("mensagem de ontem mostra 'Ontem' e a hora", () => {
  assert.equal(horaDaBolha("2026-11-03T23:30:00Z", agora), "Ontem, 20:30");
});

test("o dia é o de Brasília, não o UTC (02:30 UTC de 04/11 ainda é 03/11 em Brasília)", () => {
  assert.equal(horaDaBolha("2026-11-04T02:30:00Z", agora), "Ontem, 23:30");
});

test("mensagem mais antiga mostra dia/mês e hora; de outro ano, o ano também", () => {
  assert.equal(horaDaBolha("2026-11-02T12:00:00Z", agora), "02/11, 09:00");
  assert.equal(horaDaBolha("2025-12-31T15:00:00Z", agora), "31/12/2025, 12:00");
});

test("sem data ou data inválida: nada (a bolha não inventa hora)", () => {
  assert.equal(horaDaBolha(undefined, agora), null);
  assert.equal(horaDaBolha("não é data", agora), null);
});

test("a leitura das conversas leva a hora de envio de cada mensagem", () => {
  const s = readFileSync("src/lib/data/messages.ts", "utf8");
  assert.match(s, /enviadaEm\?: string;/);
  assert.match(s, /enviadaEm: m\.created_at/);
});

test("a tela mostra a hora em cada bolha, inclusive na mensagem que acabou de sair", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8");
  assert.match(s, /data-testid="mensagem-hora"/);
  assert.match(s, /horaDaBolha\(m\.enviadaEm\)/);
  // As três mensagens otimistas (texto, anexo e "enviar mesmo assim") levam a hora em que saíram.
  const otimistas = (s.match(/from: "me", text/g) ?? []).length;
  assert.ok(otimistas >= 3);
  assert.equal((s.match(/enviadaEm: new Date\(\)\.toISOString\(\)/g) ?? []).length, otimistas);
});
