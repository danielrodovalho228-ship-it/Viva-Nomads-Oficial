import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RESERVA_EXPIRA_MS, decidirGeracaoContrato, passoDaRespostaContrato, reservaVencida } from "./fechamento-contrato.ts";

const agora = Date.parse("2026-10-18T15:00:00Z");
const ha = (ms: number) => new Date(agora - ms).toISOString();

test("p24 — conta de teste gera e segue o caminho completo (mesmo sem assinatura digital ligada)", () => {
  assert.deepEqual(decidirGeracaoContrato({ teste: true, assinaturaLigada: false, reserva: null, agora }), {
    acao: "gerar",
    modo: "teste",
    liberarReservaVencida: false,
  });
});

test("p24 — conta real sem assinatura digital: inativa ANTES de reservar (nada fica preso)", () => {
  assert.deepEqual(decidirGeracaoContrato({ teste: false, assinaturaLigada: false, reserva: null, agora }), { acao: "inativa" });
  assert.deepEqual(decidirGeracaoContrato({ teste: false, assinaturaLigada: true, reserva: null, agora }), {
    acao: "gerar",
    modo: "real",
    liberarReservaVencida: false,
  });
});

test("p24 — segunda chamada: devolve o contrato existente (200), nunca 409", () => {
  const reserva = { externoId: "teste_abc123", criadoEm: ha(60_000) };
  assert.deepEqual(decidirGeracaoContrato({ teste: true, assinaturaLigada: false, reserva, agora }), {
    acao: "existente",
    modo: "teste",
    docId: "teste_abc123",
  });
  // Mesmo que a assinatura tenha sido desligada depois, o contrato que já existe continua valendo.
  assert.equal(decidirGeracaoContrato({ teste: false, assinaturaLigada: false, reserva, agora }).acao, "existente");
});

test("p24 — reserva sem conclusão: em andamento até 10 min; depois é liberada", () => {
  assert.equal(RESERVA_EXPIRA_MS, 600_000);
  const nova = { externoId: null, criadoEm: ha(30_000) };
  const velha = { externoId: null, criadoEm: ha(RESERVA_EXPIRA_MS + 1) };
  assert.equal(reservaVencida(nova, agora), false);
  assert.equal(reservaVencida(velha, agora), true);
  assert.deepEqual(decidirGeracaoContrato({ teste: true, assinaturaLigada: false, reserva: nova, agora }), { acao: "em_andamento" });
  assert.deepEqual(decidirGeracaoContrato({ teste: true, assinaturaLigada: false, reserva: velha, agora }), {
    acao: "gerar",
    modo: "teste",
    liberarReservaVencida: true,
  });
  // Conta real sem assinatura com reserva vencida: inativa (e a rota libera a reserva).
  assert.deepEqual(decidirGeracaoContrato({ teste: false, assinaturaLigada: false, reserva: velha, agora }), { acao: "inativa" });
});

test("p24 — a tela registra o contrato em teste e em real; inativa diz a verdade e não avança", () => {
  assert.equal(passoDaRespostaContrato(200, { modo: "teste" }), "registrar");
  assert.equal(passoDaRespostaContrato(200, { modo: "real" }), "registrar");
  assert.equal(passoDaRespostaContrato(503, { modo: "inativa" }), "inativa");
  assert.equal(passoDaRespostaContrato(409, {}), "tentar_de_novo");
  assert.equal(passoDaRespostaContrato(502, {}), "erro");
  // Resposta antiga { demo: true } sem modo não avança às cegas.
  assert.equal(passoDaRespostaContrato(200, {}), "erro");
});

test("p24 — a rota usa a regra: 503 antes de reservar, existente com 200, reserva liberada no erro", () => {
  const rota = readFileSync(new URL("../app/api/contrato/route.ts", import.meta.url), "utf8");
  assert.match(rota, /decidirGeracaoContrato\(/);
  const iInativa = rota.indexOf('d.acao === "inativa"');
  const iReserva = rota.indexOf("reservarFechamento(");
  assert.ok(iInativa > 0 && iReserva > iInativa, "o 503 da assinatura inativa vem antes da reserva");
  assert.match(rota, /concluirFechamento\(f\.leadId, "contrato", null\)/);
  assert.doesNotMatch(rota, /já foi gerado/);
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.match(tela, /passoDaRespostaContrato\(/);
  assert.doesNotMatch(tela, /res\.ok && data\.demo/);
});

test("p24 — Caução fora do 1º pagamento, mostrada ao lado; com seguro-fiança a linha some", async () => {
  const { quadroAntesDaEntrada } = await import("./fechamento-contrato.ts");
  assert.deepEqual(quadroAntesDaEntrada({ primeiroPagamento: 3930, caucao: 3200, garantia: "caucao" }), {
    primeiroPagamento: 3930,
    caucao: 3200,
    totalAntesDaEntrada: 7130,
  });
  assert.deepEqual(quadroAntesDaEntrada({ primeiroPagamento: 3930, caucao: 3200, garantia: "seguro_fianca" }), {
    primeiroPagamento: 3930,
    caucao: null,
    totalAntesDaEntrada: 3930,
  });
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.match(tela, /devolvida no fim, conforme a conferência de saída/);
  assert.match(tela, /Total antes da entrada/);
});

test("p24 — status curto da assinatura nos cartões (os dois lados)", async () => {
  const { statusAssinaturaCurto } = await import("./fechamento-contrato.ts");
  const t = "2026-10-18T12:00:00Z";
  assert.equal(statusAssinaturaCurto("inquilino", { proprietario: null, inquilino: null }), "Aguardando assinatura · falta você e o proprietário");
  assert.equal(statusAssinaturaCurto("inquilino", { proprietario: t, inquilino: null }), "Aguardando assinatura · falta você");
  assert.equal(statusAssinaturaCurto("inquilino", { proprietario: null, inquilino: t }), "Aguardando assinatura · falta o proprietário");
  assert.equal(statusAssinaturaCurto("proprietario", { proprietario: null, inquilino: t }), "Aguardando assinatura · falta você");
  assert.equal(statusAssinaturaCurto("proprietario", { proprietario: t, inquilino: t }), "Assinado pelas duas partes");
});
