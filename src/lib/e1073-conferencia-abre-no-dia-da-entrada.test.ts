/*
  E1073 — trava: a conferência de ENTRADA só abre às 00:00 (horário de Brasília) do dia da entrada. Antes disso o
  registro é recusado e a tela diz quando abre. O fecho não muda: dia da entrada no horário de check-in do anúncio
  (00:00 sem horário) + 48 h. Regra validada pelo coordenador (ORDEM-DUET-322).
  A tela é cobrada pela t1707; aqui a regra pura e a guarda de que o servidor a aplica em toda gravação da entrada.
  Roda: node --test src/lib/e1073-conferencia-abre-no-dia-da-entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aberturaConferenciaEntrada, entradaAindaNaoAbriu, erroEntradaNaoAbriu, prazoConferenciaEntrada, textoAberturaConferencia } from "./conferencia.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// 00:00 de Brasília em 10/12/2026 = 03:00 UTC (UTC−3, sem horário de verão).
const ABRE = "2026-12-10T03:00:00.000Z";

test("E1073 — abre às 00:00 de Brasília do dia da entrada, seja qual for o horário de check-in", () => {
  assert.equal(aberturaConferenciaEntrada({ inicio: "2026-12-10" })?.toISOString(), ABRE);
  assert.equal(aberturaConferenciaEntrada({ inicio: "2026-12-10", checkinAfter: "15:00" })?.toISOString(), ABRE);
  assert.equal(aberturaConferenciaEntrada({ inicio: "2026-12-10", checkinAfter: "08:30" })?.toISOString(), ABRE);
  assert.equal(aberturaConferenciaEntrada({ inicio: "2026-12-10T00:00:00" })?.toISOString(), ABRE);
});

test("E1073 — antes da abertura não abriu; no instante da abertura e depois, abriu", () => {
  const datas = { inicio: "2026-12-10", checkinAfter: "15:00" };
  assert.equal(entradaAindaNaoAbriu(datas, new Date("2026-12-10T02:59:59.999Z")), true);
  assert.equal(entradaAindaNaoAbriu(datas, new Date("2026-12-09T15:00:00.000Z")), true);
  assert.equal(entradaAindaNaoAbriu(datas, new Date(ABRE)), false);
  assert.equal(entradaAindaNaoAbriu(datas, new Date("2026-12-10T03:00:00.001Z")), false);
  assert.equal(entradaAindaNaoAbriu(datas, new Date("2026-12-11T12:00:00.000Z")), false);
});

test("E1073 — às 21h de Brasília da véspera (já dia seguinte em UTC) a conferência ainda não abriu", () => {
  // 09/12 21:30 em Brasília = 10/12 00:30 em UTC: pelo relógio UTC "já é o dia da entrada"; pelo de Brasília, não.
  assert.equal(entradaAindaNaoAbriu({ inicio: "2026-12-10" }, new Date("2026-12-10T00:30:00.000Z")), true);
});

test("E1073 — sem dia de início não há abertura a esperar (o contrato sem bloco continua como antes)", () => {
  assert.equal(aberturaConferenciaEntrada({ inicio: null }), null);
  assert.equal(entradaAindaNaoAbriu({ inicio: null }, new Date("2026-12-01T00:00:00.000Z")), false);
  assert.equal(entradaAindaNaoAbriu(null, new Date("2026-12-01T00:00:00.000Z")), false);
});

test("E1073 — o fecho não muda: dia da entrada no horário de check-in (00:00 sem horário) + 48 h", () => {
  assert.equal(prazoConferenciaEntrada({ inicio: "2026-12-10", checkinAfter: "15:00" })?.toISOString(), "2026-12-12T18:00:00.000Z");
  assert.equal(prazoConferenciaEntrada({ inicio: "2026-12-10" })?.toISOString(), "2026-12-12T03:00:00.000Z");
});

test("E1073 — os textos dizem o dia e a hora em que abre, no horário de Brasília", () => {
  assert.equal(textoAberturaConferencia(ABRE), "A conferência de entrada abre em 10/12 às 00:00, horário de Brasília (o dia da entrada).");
  assert.equal(textoAberturaConferencia(null), "");
  assert.equal(erroEntradaNaoAbriu({ inicio: "2026-12-10" }), "A conferência de entrada só abre no dia da entrada: 10/12 às 00:00, horário de Brasília.");
});

test("E1073 — o servidor recusa toda gravação da conferência de entrada antes da abertura; a saída não muda", () => {
  const acoes = ler("lib/data/conferencia-actions.ts");
  const corpo = (nome: string) => {
    const i = acoes.indexOf(`export async function ${nome}(`);
    assert.ok(i >= 0, nome);
    const j = acoes.indexOf("\nexport async function ", i + 10);
    return acoes.slice(i, j < 0 ? undefined : j);
  };
  for (const nome of ["registrarItemConferencia", "responderConferencia", "anexarLaudoConferencia"]) {
    assert.match(corpo(nome), /if \((input\.)?tipo === "entrada" && entradaAindaNaoAbriu\(ctx\.entrada\)\) return erro\(erroEntradaNaoAbriu\(ctx\.entrada\)\);/, nome);
  }
  assert.match(corpo("responderConfortoEntrada"), /if \(entradaAindaNaoAbriu\(ctx\.entrada\)\) return erro\(erroEntradaNaoAbriu\(ctx\.entrada\)\);/);
  // A página recebe a abertura e o estado calculados no servidor (o relógio do navegador não decide).
  assert.match(corpo("conferenciasDoContrato"), /aberturaEntradaEm/);
  assert.match(corpo("conferenciasDoContrato"), /entradaAindaNaoAbriu: ctx \? entradaAindaNaoAbriu\(ctx\.entrada\) : false/);
});

test("E1073 — a tela diz quando abre e não oferece registrar, anexar nem responder antes da abertura", () => {
  const tela = ler("components/contrato/conferencia-contrato.tsx");
  assert.match(tela, /const naoAbriu = tipo === "entrada" && !!dados\.entradaAindaNaoAbriu;/);
  assert.match(tela, /data-testid="conferencia-entrada-abre-em"/);
  assert.match(tela, /textoAberturaConferencia\(dados\.aberturaEntradaEm \?\? null\)/);
  assert.match(tela, /\{parte && !travada && !naoAbriu && \(\s*<form onSubmit=\{adicionar\}/);
  assert.match(tela, /\{parte && !laudo && !naoAbriu && \(/);
  assert.match(tela, /\{parte && !respondeu && !travada && !naoAbriu && !liberado && \(/);
  assert.match(tela, /\{parte && !respondeu && !travada && !naoAbriu && liberado && \(/);
});
