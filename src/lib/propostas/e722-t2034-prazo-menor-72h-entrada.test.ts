/*
  t2034 · E722 (Pista 3, lote 2, item E2) @E722 @ao-vivo-seguro
  Regra: o prazo da pré-aceitação é o MENOR entre 72 h corridas e o tempo até a entrada (início do dia de entrada, Brasília).
  Casos pedidos: entrada distante (vale 72 h) e entrada a 30 h (vale a entrada). Fronteira: entrada exatamente às 72 h.
  Roda: node --test src/lib/propostas/e722-t2034-prazo-menor-72h-entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { prazoDaPreAceitacao, textoDoPrazo } from "./pre-aceitacao.ts";

const H = 3_600_000;

test("E2: entrada distante — o prazo é de 72 h corridas", () => {
  const inicio = new Date("2026-11-10T21:00:00Z"); // 18:00 de Brasília
  const prazo = prazoDaPreAceitacao(inicio, "2027-02-01");
  assert.equal((prazo.getTime() - inicio.getTime()) / H, 72);
  assert.equal(textoDoPrazo(prazo), "13/11/2026 às 18:00 (horário de Brasília)");
});

test("E2: entrada a 30 h — o prazo é a entrada, não as 72 h", () => {
  const inicio = new Date("2026-11-10T21:00:00Z"); // 10/11 18:00 BRT; entrada 12/11 00:00 BRT = 30 h depois
  const prazo = prazoDaPreAceitacao(inicio, "2026-11-12");
  assert.equal((prazo.getTime() - inicio.getTime()) / H, 30);
  assert.equal(textoDoPrazo(prazo), "12/11/2026 às 00:00 (horário de Brasília)");
});

test("E2: fronteira — entrada exatamente às 72 h dá 72 h; um dia antes dá 48 h", () => {
  const inicio = new Date("2026-11-10T03:00:00Z"); // 10/11 00:00 BRT
  assert.equal((prazoDaPreAceitacao(inicio, "2026-11-13").getTime() - inicio.getTime()) / H, 72);
  assert.equal((prazoDaPreAceitacao(inicio, "2026-11-12").getTime() - inicio.getTime()) / H, 48);
});
