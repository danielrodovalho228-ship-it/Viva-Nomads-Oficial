/*
  E342 (resíduo, 01/11): o corte vinha do assunto ENVIADO (a caixa de teste grava o mesmo `subject` que vai ao Resend,
  até 200 caracteres). Depois do #1923 o corte já não caía no meio da palavra, mas "Renovar [TESTE QA] Automações E289…"
  e "Proposta vence 31/10 22h: [TESTE QA] Automações E289…" ainda cortavam o nome. Agora há uma forma mínima, tentada
  por último: o nome inteiro vale mais no assunto que a data (que o corpo traz).
  Roda: node --test src/lib/automacoes/e342-assunto-minimo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoAutomacao } from "./corpo-automacao.ts";
import { assuntoComTitulo, comMarca, ASSUNTO_MAX } from "../notifications/assuntos.ts";

const assunto = (s: string | null | undefined) => comMarca(String(s));
const imovel = (titulo: string) => ({ titulo, bairro: "Santa Mônica", cidade: "Uberlândia" });

test("renovação: o nome de 36 caracteres do E289 sai inteiro, sem reticências, na régua", () => {
  const s = assunto(corpoAutomacao("renovacao_aviso", { imovel: imovel("[TESTE QA] Automações E289 Renovação"), data: "2026-11-15" }).subject);
  assert.equal(s, "Renovar [TESTE QA] Automações E289 Renovação? · Viva Nomads");
  assert.ok(s.length <= ASSUNTO_MAX);
});

test("proposta: o nome sai inteiro; o prazo segue no corpo", () => {
  const c = corpoAutomacao("proposta_vencendo", { imovel: imovel("[TESTE QA] Automações E289 Proposta"), numero: "VN-PR-1", prazo: "2026-11-01T01:00:00Z" });
  const s = assunto(c.subject);
  assert.equal(s, "Proposta vencendo: [TESTE QA] Automações E289 Proposta · Viva Nomads");
  assert.ok(s.length <= ASSUNTO_MAX);
  assert.match(c.body("Ana"), /31\/10/);
});

test("título curto: continua a forma completa, com a data", () => {
  assert.equal(assunto(corpoAutomacao("renovacao_aviso", { imovel: imovel("Studio 12"), data: "2026-11-15" }).subject), "Renovar Studio 12? O período termina em 15/11 · Viva Nomads");
  assert.match(assunto(corpoAutomacao("proposta_vencendo", { imovel: imovel("Studio 12"), prazo: "2026-11-01T01:00:00Z" }).subject), /^Proposta de Studio 12 vence em 31\/10/);
});

test("título médio: a forma intermediária (com a data curta) ainda é preferida à mínima", () => {
  const s = assunto(corpoAutomacao("renovacao_aviso", { imovel: imovel("Apto 2 quartos no Centro"), data: "2026-11-15" }).subject);
  assert.equal(s, "Renovar Apto 2 quartos no Centro? Termina em 15/11 · Viva Nomads");
});

test("assuntoComTitulo aceita uma forma curta só (compatível) ou uma lista, tentada em ordem", () => {
  // Uma forma só, como antes do resíduo.
  assert.equal(assuntoComTitulo("Instruções de chegada: ", "[TESTE QA] Automações E289 Chegada", ", entrada 10/11", { antes: "Chegada em 10/11: " }), "Chegada em 10/11: [TESTE QA] Automações E289 Chegada");
  // Lista: a primeira forma em que o nome cabe inteiro ganha.
  const t = "Casa com piscina no Jardim Karaíba";
  const formas = [{ antes: "Forma intermediária com data 10/11: " }, { antes: "Curta: " }];
  assert.equal(assuntoComTitulo("Um prefixo comprido demais para caber: ", t, "", formas), `Curta: ${t}`);
  assert.equal(assuntoComTitulo("Longo: ", "Casa 1", "", formas), "Longo: Casa 1");
});
