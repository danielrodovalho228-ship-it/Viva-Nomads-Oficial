/*
  Atendimento: prazos com horário humano (relógio injetável) e classificação.
  Roda: node --test src/lib/atendimento/atendimento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPrazos,
  dentroDoHorario,
  estadoPrazo,
  mensagemPrazo,
  prazoManutencao,
  proximaAbertura,
  somarHorasUteis,
} from "../../config/atendimento.ts";
import { avisoEmergencia, classificar, detectarEmergencia, detectarRiscoP1, numeroEmergencia, urgenciaManutencao, AVISO_EMERGENCIA } from "./classificar.ts";

// Horas em Brasília = UTC−3.
const br = (iso: string) => new Date(`${iso}-03:00`);
const emBR = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

test("horário humano 7h–22h", () => {
  assert.equal(dentroDoHorario(br("2026-10-06T07:00")), true);
  assert.equal(dentroDoHorario(br("2026-10-06T21:59")), true);
  assert.equal(dentroDoHorario(br("2026-10-06T22:00")), false);
  assert.equal(dentroDoHorario(br("2026-10-06T03:00")), false);
  assert.equal(emBR(proximaAbertura(br("2026-10-06T23:30"))), "2026-10-07 07:00");
  assert.equal(emBR(proximaAbertura(br("2026-10-06T05:10"))), "2026-10-06 07:00");
});

test("P1 dentro do horário: 1 h; resolução no mesmo dia", () => {
  const p = calcularPrazos("p1", br("2026-10-06T10:00"));
  assert.equal(emBR(p.primeiraResposta), "2026-10-06 11:00");
  assert.equal(emBR(p.resolucao), "2026-10-06 22:00");
});

test("P1 às 23h: 1ª resposta às 8h do dia seguinte (virada de dia)", () => {
  const p = calcularPrazos("p1", br("2026-10-06T23:00"));
  assert.equal(emBR(p.primeiraResposta), "2026-10-07 08:00");
  assert.equal(emBR(p.resolucao), "2026-10-07 22:00");
});

test("P1 às 21h30: a hora pula a noite", () => {
  const p = calcularPrazos("p1", br("2026-10-06T21:30"));
  assert.equal(emBR(p.primeiraResposta), "2026-10-07 07:30");
});

test("P2: 4 horas úteis, atravessando a noite", () => {
  assert.equal(emBR(calcularPrazos("p2", br("2026-10-06T09:00")).primeiraResposta), "2026-10-06 13:00");
  assert.equal(emBR(calcularPrazos("p2", br("2026-10-06T20:00")).primeiraResposta), "2026-10-07 09:00");
});

test("P3 = 1 dia útil (15 h de janela); P4 = 3 dias úteis", () => {
  assert.equal(emBR(calcularPrazos("p3", br("2026-10-06T10:00")).primeiraResposta), "2026-10-07 10:00");
  assert.equal(emBR(calcularPrazos("p4", br("2026-10-06T10:00")).primeiraResposta), "2026-10-09 10:00");
});

test("somarHorasUteis aceita frações", () => {
  assert.equal(emBR(somarHorasUteis(br("2026-10-06T21:45"), 0.5)), "2026-10-07 07:15");
});

test("manutenção: horas corridas (4/24/72)", () => {
  assert.equal(emBR(prazoManutencao("urgente", br("2026-10-06T23:00"))), "2026-10-07 03:00");
  assert.equal(emBR(prazoManutencao("media", br("2026-10-06T10:00"))), "2026-10-07 10:00");
  assert.equal(emBR(prazoManutencao("baixa", br("2026-10-06T10:00"))), "2026-10-09 10:00");
});

test("estado do prazo: ok, em risco (75%), estourado, cumprido", () => {
  const a = br("2026-10-06T10:00");
  const prazo = br("2026-10-06T11:00");
  assert.equal(estadoPrazo(a, prazo, br("2026-10-06T10:30"), false), "ok");
  assert.equal(estadoPrazo(a, prazo, br("2026-10-06T10:46"), false), "em_risco");
  assert.equal(estadoPrazo(a, prazo, br("2026-10-06T11:00"), false), "estourado");
  assert.equal(estadoPrazo(a, prazo, br("2026-10-06T12:00"), true), "cumprido");
});

test("mensagem fora do horário diz a partir de que horas", () => {
  assert.match(mensagemPrazo("p2", br("2026-10-06T23:00")), /a partir das 7h/);
  assert.match(mensagemPrazo("p2", br("2026-10-06T10:00")), /até 4 horas/);
});

test("emergência: gás, incêndio, violência (com e sem acento)", () => {
  assert.equal(detectarEmergencia("Sinto cheiro de gás na cozinha"), "gas");
  assert.equal(detectarEmergencia("o predio esta PEGANDO FOGO"), "incendio");
  assert.equal(detectarEmergencia("Estou sendo ameaçado pelo proprietário"), "violencia");
  assert.equal(detectarEmergencia("O chuveiro queimou"), null);
  assert.equal(AVISO_EMERGENCIA, "Em emergência ligue 193 (bombeiros) ou 190 (polícia).");
});

test("emergência: as 3 frases da revisão viram aviso e P1", () => {
  const casos: [string, string, "193" | "190"][] = [
    ["o proprietário disse que vai me bater", "violencia", "190"],
    ["arrombaram a porta e invadiram o imóvel", "invasao", "190"],
    ["curto-circuito, saiu fumaça da tomada", "eletrica", "193"],
  ];
  for (const [frase, tipo, numero] of casos) {
    const e = detectarEmergencia(frase);
    assert.equal(e, tipo, frase);
    assert.equal(numeroEmergencia(e!), numero, frase);
    assert.match(avisoEmergencia(e), new RegExp(`Ligue agora para ${numero}`), frase);
    assert.equal(classificar("duvida", frase).prioridade, "p1", frase);
  }
});

test("emergência: variações (flexões, sem acento, maiúsculas)", () => {
  const casos: [string, "193" | "190"][] = [
    ["ELE ME ESPANCOU ontem à noite", "190"],
    ["o dono ameaçou me matar", "190"],
    ["o vizinho puxou uma faca pra mim", "190"],
    ["tem um homem armado na porta", "190"],
    ["alguem entrou no apto enquanto eu dormia e roubaram meu notebook", "190"],
    ["Fui roubada dentro do imovel", "190"],
    ["houve uma invasão no prédio", "190"],
    ["levei um choque eletrico no chuveiro", "193"],
    ["a tomada está faiscando", "193"],
    ["cheiro de queimado vindo do quadro de luz", "193"],
    ["o botijão está vazando", "193"],
    ["teve uma explosão na cozinha", "193"],
    ["incendio no predio", "193"],
  ];
  for (const [frase, numero] of casos) {
    const e = detectarEmergencia(frase);
    assert.ok(e, frase);
    assert.equal(numeroEmergencia(e!), numero, frase);
  }
});

test("emergência: sem falso positivo em frases comuns", () => {
  for (const frase of [
    "O chuveiro queimou",
    "faça o favor de responder",
    "esse preço é um roubo",
    "a conta de gás veio alta",
    "o vizinho fuma e a fumaça de cigarro entra",
    "quero bater um papo sobre o contrato",
    "o armário da cozinha está quebrado",
  ]) {
    assert.equal(detectarEmergencia(frase), null, frase);
  }
  assert.equal(avisoEmergencia(null), AVISO_EMERGENCIA);
});

test("risco que vira P1: golpe, Pix direto, trancado", () => {
  assert.equal(detectarRiscoP1("O dono pediu para eu pagar a caução por Pix direto pra ele"), true);
  assert.equal(detectarRiscoP1("Cheguei e o imóvel está trancado, ninguém atende"), true);
  assert.equal(detectarRiscoP1("acho que é golpe"), true);
  assert.equal(detectarRiscoP1("Como funciona a caução?"), false);
  assert.equal(detectarRiscoP1("Quero pagar o plano"), false);
});

test("classificar: categoria + elevação a P1", () => {
  assert.deepEqual(classificar("duvida", "Como funciona a caução?"), { tipo: "suporte", prioridade: "p3", emergencia: null });
  assert.deepEqual(classificar("sugestao", "adorei"), { tipo: "suporte", prioridade: "p4", emergencia: null });
  assert.deepEqual(classificar("duvida", "Sinto cheiro de gás"), { tipo: "seguranca", prioridade: "p1", emergencia: "gas" });
  assert.equal(classificar("duvida", "pediu Pix direto pra ele").prioridade, "p1");
  assert.equal(classificar("categoria-inexistente", "oi").prioridade, "p3");
});

test("urgência da manutenção: falta de água é urgente", () => {
  assert.equal(urgenciaManutencao("Estou sem água desde ontem"), "urgente");
  assert.equal(urgenciaManutencao("O chuveiro queimou"), "media");
  assert.equal(urgenciaManutencao("O chuveiro queimou", "baixa"), "baixa");
  assert.equal(urgenciaManutencao("ok", "urgente"), "urgente");
});

import { FAQ, buscarFaq, respostaPara } from "./faq.ts";
import { CATEGORIAS } from "./classificar.ts";

test("FAQ: caução fala de poupança e 50% — nunca 'conta vinculada'", () => {
  const c = FAQ.find((p) => p.id === "caucao")!;
  assert.match(c.resposta, /poupança/);
  assert.match(c.resposta, /50%/);
  for (const p of FAQ) {
    assert.doesNotMatch(p.resposta, /conta vinculada|garantia do aluguel|inquilino verificado|apartamentos/i, p.id);
  }
});

test("FAQ: busca com erro de digitação e sem acento", () => {
  assert.equal(buscarFaq("oi qro sabe d caucao q eh isso")[0].id, "caucao");
  assert.equal(buscarFaq("esqueci a senha")[0].id, "senha");
  assert.equal(buscarFaq("whatsapp do proprietario")[0].id, "contato");
  assert.equal(buscarFaq("").length, FAQ.length);
});

test("FAQ manutenção: a opção só é citada para quem tem contrato ativo", () => {
  const m = FAQ.find((p) => p.id === "manutencao")!;
  const rotulo = CATEGORIAS.find((c) => c.key === "manutencao")!.rotulo;
  assert.match(respostaPara(m, "com_contrato"), new RegExp(rotulo));
  assert.doesNotMatch(respostaPara(m, "visitante"), new RegExp(rotulo));
  assert.doesNotMatch(respostaPara(m, "sem_contrato"), new RegExp(rotulo));
  assert.match(respostaPara(m, "visitante"), /Entre na sua conta e abra pelo seu contrato \("Problema com isto\?"\)/);
  for (const perfil of ["visitante", "sem_contrato", "com_contrato"] as const) assert.match(respostaPara(m, perfil), /4 horas/);
});

test("FAQ pagamento por fora: sem falar da poupança da caução", () => {
  const g = FAQ.find((p) => p.id === "golpe")!;
  assert.doesNotMatch(g.resposta, /poupança|conta pessoal/);
  assert.match(g.resposta, /^Não pague nada fora do que está no contrato assinado pela plataforma\. A Viva Nomads nunca pede Pix ou depósito\./);
  assert.match(g.resposta, /prioridade máxima/);
});

test("promessa pública: Viva 24 h e pessoa em até 24 h — nunca a janela 7h–22h", async () => {
  const { PROMESSA_ATENDIMENTO } = await import("../../config/atendimento.ts");
  assert.equal(PROMESSA_ATENDIMENTO, "Assistente Viva 24 h · resposta de uma pessoa em até 24 h");
  for (const p of FAQ) assert.doesNotMatch(p.resposta, /7h às 22h/, p.id);
  assert.doesNotMatch(mensagemPrazo("p2", br("2026-10-06T23:00")), /Nosso horário de atendimento/);
});
