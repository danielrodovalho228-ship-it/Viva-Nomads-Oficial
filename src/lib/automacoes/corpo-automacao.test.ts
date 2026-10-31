/*
  E289 (grupo 1) — os 5 e-mails do cron de automações com os fatos do caso no assunto e no corpo.
  Roda: node --test src/lib/automacoes/corpo-automacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoAutomacao, TIPOS_COM_CORPO, type TipoCorpoAutomacao } from "./corpo-automacao.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";

const IMOVEL = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
const PROIBIDAS = /comiss[ãa]o|aluguel/i;

test("saída (3 dias): imóvel, data e horário da saída no assunto, no corpo e no bloco", () => {
  const c = corpoAutomacao("saida_lembrete", { imovel: IMOVEL, data: "2026-11-03", horario: "11:00:00" });
  assert.equal(c.subject, "Lembrete: saída de Apto Santa Mônica em 03/11/2026");
  assert.equal(c.body("Lara"), "Olá Lara, a saída de Apto Santa Mônica é em 03/11/2026 (até as 11:00). Combine a conferência de saída pela plataforma.");
  assert.deepEqual(c.linhas, [
    { rotulo: "Imóvel", valor: "Apto Santa Mônica · Santa Mônica, Uberlândia" },
    { rotulo: "Saída", valor: "03/11/2026, até as 11:00" },
  ]);
});

test("avaliação (1 dia depois): imóvel e data em que a estadia terminou", () => {
  const c = corpoAutomacao("avaliacao_pedido", { imovel: IMOVEL, data: "2026-10-30" });
  assert.equal(c.subject, "Como foi a estadia em Apto Santa Mônica? Deixe sua avaliação");
  assert.match(c.body("Daniel"), /^Olá Daniel, a estadia em Apto Santa Mônica terminou em 30\/10\/2026\./);
});

test("renovação (15 dias antes): imóvel e o fim do período", () => {
  const c = corpoAutomacao("renovacao_aviso", { imovel: IMOVEL, data: "2026-11-15" });
  assert.equal(c.subject, "Apto Santa Mônica: o período termina em 15/11/2026. Quer renovar?");
  assert.match(c.body("Lara"), /^Olá Lara, o período atual do contrato de Apto Santa Mônica termina em 15\/11\/2026\./);
  assert.deepEqual(c.linhas.at(-1), { rotulo: "Fim do período", valor: "15/11/2026" });
});

test("proposta vencendo (24 h): número, imóvel e o prazo em data e hora de Brasília", () => {
  const c = corpoAutomacao("proposta_vencendo", { imovel: IMOVEL, numero: "VN-PR-0042", prazo: "2026-10-31T21:30:00Z" });
  assert.equal(c.subject, "Proposta VN-PR-0042 de Apto Santa Mônica vence em 31/10/2026 18:30");
  assert.equal(c.body("Lara"), "Olá Lara, a proposta VN-PR-0042 de Apto Santa Mônica aguarda a sua resposta e vence em 31/10/2026 18:30 (horário de Brasília). Aceite, contraproponha ou recuse pela plataforma.");
  assert.deepEqual(c.linhas.slice(1), [
    { rotulo: "Proposta", valor: "VN-PR-0042" },
    { rotulo: "Vence em", valor: "31/10/2026 18:30 (horário de Brasília)" },
  ]);
});

test("instruções pendentes (D-10): imóvel, data e horário da entrada e o dia em que o morador recebe (D-7)", () => {
  const c = corpoAutomacao("estadia_instrucoes_pendentes", { imovel: IMOVEL, data: "2026-11-10", horario: "14:00" });
  assert.equal(c.subject, "Instruções de chegada de Apto Santa Mônica: entrada em 10/11/2026");
  assert.equal(c.body("Daniel"), "Olá Daniel, a entrada do morador em Apto Santa Mônica é em 10/11/2026. Preencha as instruções de chegada: o morador as recebe em 03/11/2026.");
  assert.deepEqual(c.linhas.slice(1), [
    { rotulo: "Entrada do morador", valor: "10/11/2026, a partir das 14:00" },
    { rotulo: "O morador recebe as instruções em", valor: "03/11/2026" },
  ]);
});

test("sem dado (imóvel apagado, data vazia): frase completa, sem 'undefined', sem fato inventado", () => {
  for (const t of TIPOS_COM_CORPO) {
    const c = corpoAutomacao(t as TipoCorpoAutomacao, { imovel: null });
    for (const s of [c.subject, c.body(), c.body("Lara")]) {
      assert.doesNotMatch(s, /undefined|null|NaN|—|\s{2}| ,|\.\./, `${t}: "${s}"`);
    }
    assert.deepEqual(c.linhas, []);
  }
});

test("vocabulário da plataforma: nenhum assunto ou corpo fala em comissão ou aluguel; nenhuma frase genérica antiga", () => {
  const dados = { imovel: IMOVEL, data: "2026-11-03", horario: "11:00", numero: "VN-PR-1", prazo: "2026-10-31T21:30:00Z" };
  for (const t of TIPOS_COM_CORPO) {
    const c = corpoAutomacao(t as TipoCorpoAutomacao, dados);
    const tudo = [c.subject, c.body("Lara"), ...c.linhas.map((l) => l.valor)].join(" ");
    assert.doesNotMatch(tudo, PROIBIDAS, t);
    // O corpo novo não é o do modelo genérico (que não nomeia o imóvel).
    assert.notEqual(c.body("Lara"), TEMPLATES[t as TipoCorpoAutomacao].body("Lara"), t);
    assert.ok(c.body("Lara").includes("Apto Santa Mônica"), t);
  }
});

test("ponto de envio: o cron passa os fatos dos 5 avisos ao construtor (assunto, corpo e bloco)", () => {
  const cron = readFileSync("src/app/api/cron/automacoes/route.ts", "utf8");
  for (const t of TIPOS_COM_CORPO) assert.match(cron, new RegExp(`\\.\\.\\.comFatos\\("${t}", \\{ imovel:`), t);
  assert.match(cron, /properties\(owner_id, title, address, city, checkout_before\)/);
  assert.match(cron, /properties\(title, address, city\), proposta_versoes/);
  assert.match(cron, /comFatos\("proposta_vencendo", \{[^\n]*prazo: p\.valida_ate as string \}\)/);
  assert.match(cron, /comFatos\("estadia_instrucoes_pendentes", \{[^\n]*data: inicio, horario: prop\.checkin_after \}\)/);
});
