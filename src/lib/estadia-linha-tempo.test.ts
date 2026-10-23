/*
  Pacote Clareza UX6 (ordem f1b437bb), item (a) — linha do tempo da estadia.
  Roda: node --test src/lib/estadia-linha-tempo.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { montarLinhaDoTempo, formatarDiaCurto } from "./estadia-linha-tempo.ts";

test("entrada e saída trazem dia e horário do imóvel", () => {
  const l = montarLinhaDoTempo({ inicio: "2026-11-01", fim: "2027-01-30", checkinAfter: "14:00", checkoutBefore: "11:00" });
  const [entrada, conf, saida] = l;
  assert.equal(entrada.chave, "entrada");
  assert.equal(entrada.dia, "2026-11-01");
  assert.equal(entrada.horario, "a partir das 14:00, horário de Brasília");
  assert.equal(conf.chave, "conferencia");
  assert.equal(conf.dia, "2026-11-03", "conferência de entrada vale até 48 h depois do início");
  assert.equal(conf.horario, "até 03/11 às 14:00, horário de Brasília");
  assert.equal(conf.prazo, "2026-11-03T17:00:00.000Z");
  assert.equal(saida.chave, "saida");
  assert.equal(saida.dia, "2027-01-30");
  assert.equal(saida.horario, "até as 11:00, horário de Brasília");
});

test("sem horário cadastrado, avisa que será combinado (nunca inventa hora)", () => {
  const [entrada, , saida] = montarLinhaDoTempo({ inicio: "2026-11-01", fim: "2027-01-30", checkinAfter: null, checkoutBefore: "" });
  assert.equal(entrada.horario, "horário a combinar");
  assert.equal(saida.horario, "horário a combinar");
});

test("horário fora do formato HH:MM é ignorado", () => {
  const [entrada] = montarLinhaDoTempo({ inicio: "2026-11-01", fim: "2027-01-30", checkinAfter: "<b>x</b>", checkoutBefore: null });
  assert.equal(entrada.horario, "horário a combinar");
});

test("sem datas do contrato, não monta linha do tempo", () => {
  assert.deepEqual(montarLinhaDoTempo({ inicio: null, fim: null, checkinAfter: "14:00", checkoutBefore: "11:00" }), []);
});

test("dia curto em português: 01 nov", () => {
  assert.equal(formatarDiaCurto("2026-11-01"), "01 nov");
  assert.equal(formatarDiaCurto("2027-01-30"), "30 jan");
});

import { readFileSync } from "node:fs";

test("ligação: a leitura do contrato traz blocos e horários e o detalhe mostra a linha do tempo", () => {
  const acao = readFileSync(new URL("./data/contrato-assinar-actions.ts", import.meta.url), "utf8");
  assert.match(acao, /contrato_blocos\(inicio, fim\)/);
  assert.match(acao, /checkin_after, checkout_before/);
  assert.match(acao, /montarLinhaDoTempo/);
  const detalhe = readFileSync(new URL("../components/contrato/contrato-detalhe.tsx", import.meta.url), "utf8");
  assert.match(detalhe, /<LinhaDoTempoEstadia etapas=\{c\.linhaDoTempo\}/);
  const tela = readFileSync(new URL("../components/contrato/linha-do-tempo-estadia.tsx", import.meta.url), "utf8");
  assert.match(tela, /href="\/dashboard\/mensagens"/);
});

test("F2: linha do tempo e seção da conferência dão o MESMO instante (fonte única)", async () => {
  const { prazoConferenciaEntrada, textoPrazoConferencia } = await import("./conferencia.ts");
  const p = { inicio: "2026-10-18", fim: "2026-12-16", checkinAfter: "15:00", checkoutBefore: "11:00" };
  const conf = montarLinhaDoTempo(p).find((e) => e.chave === "conferencia")!;
  const prazo = prazoConferenciaEntrada({ inicio: p.inicio, checkinAfter: p.checkinAfter })!;
  assert.equal(conf.prazo, prazo.toISOString());
  assert.equal(conf.horario, textoPrazoConferencia(prazo));
  assert.equal(conf.horario, "até 20/10 às 15:00, horário de Brasília");
  assert.equal(conf.dia, "2026-10-20");
  // a seção da conferência e o servidor usam a mesma função (sem outra conta de 48 h)
  const acoes = readFileSync(new URL("./data/conferencia-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /prazoConferenciaEntrada\(ctx\.entrada\)/);
  const secao = readFileSync(new URL("../components/contrato/conferencia-contrato.tsx", import.meta.url), "utf8");
  assert.match(secao, /textoPrazoConferencia\(dados\.prazoEntradaEm\)/);
  assert.doesNotMatch(secao, /toLocaleString\(/);
});
