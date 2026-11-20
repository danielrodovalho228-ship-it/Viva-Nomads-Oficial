/*
  E663 — Jornada de mensagens da estadia: 4 momentos (confirmação com pedido de documentos, chegada, semana da saída e,
  em estadia longa, o meio da estadia). O D-7 (instruções liberadas) já existe e é reaproveitado, não duplicado.
  As datas saem das datas ATUAIS do contrato: remarcar por aditivo (E652) recalcula tudo e rearma os envios (a data
  entra na chave). Documentos pedidos só pela plataforma (E441: nada de dado pessoal, foto ou contato no e-mail).
  Roda: node --test src/lib/estadia/jornada-mensagens.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MEIO_ESTADIA_MIN_DIAS,
  confirmacaoDevida,
  corpoDaJornada,
  chaveDaJornada,
  jornadaDaEstadia,
  momentosDeHoje,
} from "./jornada-mensagens.ts";

const longa = { entrada: "2027-01-10", fim: "2027-03-20" }; // 69 dias

test("datas da jornada: chegada, semana da saída (7 dias antes) e meio (só estadia longa)", () => {
  assert.equal(MEIO_ESTADIA_MIN_DIAS, 60);
  assert.deepEqual(jornadaDaEstadia(longa), { d7: "2027-01-03", chegada: "2027-01-10", semanaSaida: "2027-03-13", meio: "2027-02-13" });
  assert.equal(jornadaDaEstadia({ entrada: "2027-01-10", fim: "2027-02-24" }).meio, null, "45 dias: sem mensagem do meio");
  assert.equal(jornadaDaEstadia({ entrada: "2027-01-10", fim: "2027-03-11" }).meio, "2027-02-09", "60 dias já é longa");
  assert.equal(jornadaDaEstadia({ entrada: "2027-01-10", fim: "2027-01-15" }).semanaSaida, null, "estadia curtíssima: a semana da saída cairia antes da chegada");
});

test("momentosDeHoje: só o que cai hoje, sem a confirmação (essa é por assinatura)", () => {
  assert.deepEqual(momentosDeHoje({ ...longa, hoje: "2027-01-10" }), ["jornada_chegada"]);
  assert.deepEqual(momentosDeHoje({ ...longa, hoje: "2027-02-13" }), ["jornada_meio_estadia"]);
  assert.deepEqual(momentosDeHoje({ ...longa, hoje: "2027-03-13" }), ["jornada_semana_saida"]);
  assert.deepEqual(momentosDeHoje({ ...longa, hoje: "2027-02-01" }), []);
});

test("remarcou por aditivo: as datas recalculam e a chave muda, então a jornada reenvia nas datas NOVAS", () => {
  const depois = { entrada: "2027-01-24", fim: "2027-04-03" };
  assert.deepEqual(momentosDeHoje({ ...depois, hoje: "2027-01-10" }), [], "a data antiga não dispara mais");
  assert.deepEqual(momentosDeHoje({ ...depois, hoje: "2027-01-24" }), ["jornada_chegada"]);
  assert.deepEqual(momentosDeHoje({ ...depois, hoje: "2027-03-27" }), ["jornada_semana_saida"]);
  assert.notEqual(chaveDaJornada("jornada_chegada", longa), chaveDaJornada("jornada_chegada", depois), "chegada antiga já enviada não bloqueia a nova");
  assert.notEqual(chaveDaJornada("jornada_semana_saida", longa), chaveDaJornada("jornada_semana_saida", depois));
  assert.notEqual(chaveDaJornada("jornada_meio_estadia", longa), chaveDaJornada("jornada_meio_estadia", depois));
  // Mudou só a saída (prorrogação): a chegada não rearma; a semana da saída sim.
  const prorrogou = { entrada: longa.entrada, fim: "2027-04-20" };
  assert.equal(chaveDaJornada("jornada_chegada", longa), chaveDaJornada("jornada_chegada", prorrogou));
  assert.notEqual(chaveDaJornada("jornada_semana_saida", longa), chaveDaJornada("jornada_semana_saida", prorrogou));
});

test("confirmação: sai logo depois da assinatura das duas partes (hoje ou ontem), nunca em contrato antigo", () => {
  assert.equal(confirmacaoDevida({ assinadoEm: "2027-01-02T15:00:00Z", hoje: "2027-01-02" }), true);
  assert.equal(confirmacaoDevida({ assinadoEm: "2027-01-02T15:00:00Z", hoje: "2027-01-03" }), true);
  assert.equal(confirmacaoDevida({ assinadoEm: "2027-01-02T15:00:00Z", hoje: "2027-01-05" }), false, "sem o 1º pagamento, contrato antigo não recebe");
  // 01h UTC ainda é a noite anterior em Brasília.
  assert.equal(confirmacaoDevida({ assinadoEm: "2027-01-03T01:00:00Z", hoje: "2027-01-02" }), true);
  assert.equal(confirmacaoDevida({ assinadoEm: null, hoje: "2027-01-02" }), false);
});

test("textos: confirmação pede os documentos PELA PLATAFORMA e não carrega dado pessoal (E441)", () => {
  const im = { id: "11111111-1111-4111-8111-111111111111", titulo: "Loft Centro", bairro: "Centro", cidade: "Uberlândia" };
  const c = corpoDaJornada("jornada_confirmacao", { imovel: im, ...longa });
  assert.match(c.texto, /documento/i);
  assert.match(c.texto, /pela plataforma/i);
  assert.match(c.texto, /Loft Centro/);
  assert.doesNotMatch(c.texto, /@|\d{4,}-?\d{4}|whats/i, "sem e-mail, telefone nem canal de fora");
  assert.doesNotMatch(c.texto, /comiss|alugu/i, "vocabulário da casa");
  const ch = corpoDaJornada("jornada_chegada", { imovel: im, ...longa, horario: "14:00" });
  assert.match(ch.texto, /10\/01\/2027/);
  assert.match(ch.texto, /14:00/);
  const sem = corpoDaJornada("jornada_semana_saida", { imovel: im, ...longa, horarioSaida: "11:00" });
  assert.match(sem.texto, /20\/03\/2027/);
  assert.match(sem.texto, /11:00/);
  const meio = corpoDaJornada("jornada_meio_estadia", { imovel: im, ...longa });
  assert.match(meio.texto, /quebrad|defeito|conserto|precis/i, "pergunta se algo quebrou");
  assert.match(meio.texto, /avalia/i, "pede a avaliação parcial");
});

test("o cron da jornada usa o motor das automações (chave por pessoa+data) e respeita o modo simulado", () => {
  const cron = readFileSync(new URL("../../app/api/cron/automacoes/route.ts", import.meta.url), "utf8");
  assert.match(cron, /momentosDeHoje\(/);
  assert.match(cron, /confirmacaoDevida\(/);
  assert.match(cron, /chaveDaJornada\(/);
  assert.match(cron, /tipo: momento/);
});
