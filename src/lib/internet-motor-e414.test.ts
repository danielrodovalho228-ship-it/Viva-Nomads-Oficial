/*
  E414 — a medição da internet na Qualificação não concluía e o item ficava travado.
  Roda: node --test src/lib/internet-motor-e414.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comPrazo, PRAZO_RODADA_MS } from "./internet-motor.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("rodada parada passa do prazo: para o motor e falha com 'demorou' (nada fica em 'Medindo… 95%')", async () => {
  let parou = false;
  const nunca = new Promise<number>(() => {});
  await assert.rejects(comPrazo(nunca, 20, () => (parou = true)), /demorou/);
  assert.equal(parou, true);
});

test("rodada que termina a tempo devolve o resultado e não para o motor", async () => {
  let parou = false;
  assert.equal(await comPrazo(Promise.resolve(42), 1000, () => (parou = true)), 42);
  // Erro da própria biblioteca continua chegando como era.
  await assert.rejects(comPrazo(Promise.reject(new Error("incompleto")), 1000, () => (parou = true)), /incompleto/);
  assert.equal(parou, false);
});

test("o motor real usa o prazo; prazo de 1 minuto por rodada", () => {
  assert.equal(PRAZO_RODADA_MS, 60_000);
  assert.match(ler("./internet-motor.ts"), /return \{ promessa: comPrazo\(promessa, PRAZO_RODADA_MS, \(\) => motor\?\.pause\(\)\), cancelar/);
});

test("a tela avisa: estado que não carrega mostra o motivo, e a rodada que demora diz que parou", () => {
  const tela = ler("../components/anuncio/medir-internet.tsx");
  assert.doesNotMatch(tela, /if \(!estado\.ok\) return null;/);
  assert.match(tela, /if \(!estado\.ok\)\s*return \([\s\S]*?data-testid="medir-internet-indisponivel"[\s\S]*?\{estado\.erro\}/);
  assert.match(tela, /A medição demorou demais e parou\. Confira o Wi-Fi e tente de novo\./);
});
