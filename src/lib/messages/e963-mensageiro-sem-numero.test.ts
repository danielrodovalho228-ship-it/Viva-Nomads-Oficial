/*
  E963 — "me chama no zap" SEM número não abria o aviso do E585: o aviso só abria quando algo era mascarado, e a
  expressão sozinha não tem o que mascarar. Regra já decidida (Família 6, parte C): citar um mensageiro fora da
  plataforma (zap, whats, WhatsApp, wpp, telegram) abre o aviso ao digitar; a prévia é o próprio texto (a palavra fica,
  nada some) e o envio só sai pelo "Enviar mesmo assim". Metade do cliente; o servidor não muda.
  Gatilho (decisão do Gerente, ORDEM-DUET-072): o PADRÃO DE CONVITE — verbo de contato + mensageiro ("me chama no zap",
  "chama no whats", "fala comigo no WhatsApp") ou o pedido do mensageiro do outro ("tem whats?", "qual seu zap?"). A menção
  negada ou declarativa ("aqui não uso WhatsApp") NÃO abre o aviso: é o contrário do convite.
  Roda: node --test src/lib/messages/e963-mensageiro-sem-numero.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoAntesDeEnviar, previaAoDigitar } from "./aviso-envio.ts";

test("E963 — 'me chama no zap' sem número abre o aviso ao digitar, com o texto inteiro na prévia", () => {
  assert.equal(previaAoDigitar("me chama no zap"), "me chama no zap");
});

test("E963 — os equivalentes do convite também abrem o aviso (whats, WhatsApp, wpp, zapzap, telegram; pedido do contato)", () => {
  for (const t of ["chama no whats", "fala comigo no WhatsApp", "manda msg no wpp", "me add no zapzap", "prefiro falar pelo Telegram", "Tem WhatsApp?", "qual seu zap?", "me passa seu whats"]) {
    assert.equal(previaAoDigitar(t), t, t);
  }
});

test("E963 — no envio, a expressão sozinha pede confirmação (Enter não envia direto) e sai sem mudar o texto", () => {
  assert.deepEqual(avisoAntesDeEnviar("me chama no zap"), { tipo: "confirmar", previa: "me chama no zap" });
});

test("E963 — menção negada ou declarativa NÃO abre o aviso (é o contrário do convite)", () => {
  for (const t of ["aqui não uso WhatsApp", "não tenho whats, prefiro falar por aqui", "não me chama no zap, vamos seguir aqui", "o WhatsApp da portaria está fora do ar", "Uso mais o Telegram no trabalho"]) {
    assert.equal(previaAoDigitar(t), null, t);
  }
});

test("E963 — palavra parecida não é mensageiro: texto limpo segue livre", () => {
  for (const t of ["Posso visitar sábado?", "O zelador abre às 8h", "Rua Zapata, 120", "o prédio tem portaria 24h", "me chama quando chegar"]) {
    assert.equal(previaAoDigitar(t), null, t);
  }
});

test("E963 — com número, segue a máscara de sempre (o número some, a palavra fica)", () => {
  const p = previaAoDigitar("me chama no zap (34) 99876-5432") ?? "";
  assert.match(p, /zap/);
  assert.match(p, /\[contato protegido\]/);
  assert.doesNotMatch(p, /99876/);
});

test("E963 — resposta rápida segue o bloqueio do 55-E2, não a prévia", () => {
  assert.equal(previaAoDigitar("me chama no zap", { deRapida: true }), null);
});
