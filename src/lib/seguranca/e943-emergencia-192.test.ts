/*
  E943: a linha de emergência de /seguranca (E853) omitia o 192 (SAMU). Ela dizia "ligue 190 ou 193", com polícia e
  bombeiros, mas sem ambulância. Agora diz "ligue 190, 192 ou 193", e os três números ligam no celular (tel:).
  Roda: node --test src/lib/seguranca/e943-emergencia-192.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { FRASE_EMERGENCIA_SEGURANCA, NUMEROS_EMERGENCIA, pedacosDaFraseEmergencia } from "./emergencia.ts";

test("E943 — a linha de emergência inclui o 192 (SAMU): 'ligue 190, 192 ou 193'", () => {
  assert.equal(FRASE_EMERGENCIA_SEGURANCA, "Em uma emergência, ligue 190, 192 ou 193. A Viva não recebe esse tipo de ligação.");
  assert.deepEqual([...NUMEROS_EMERGENCIA], ["190", "192", "193"]);
});

test("E943 — os três números ligam (tel:) e o texto não muda", () => {
  const pedacos = pedacosDaFraseEmergencia();
  assert.equal(pedacos.map((p) => p.texto).join(""), FRASE_EMERGENCIA_SEGURANCA);
  assert.deepEqual(pedacos.filter((p) => p.href).map((p) => p.href), ["tel:190", "tel:192", "tel:193"]);
});
