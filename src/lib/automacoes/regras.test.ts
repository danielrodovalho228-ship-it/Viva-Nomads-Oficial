import test from "node:test";
import assert from "node:assert/strict";
import {
  avisoAnuncioIncompleto,
  lembreteDeSaida,
  pedirAvaliacao,
  avisarRenovacao,
  chaveEnvio,
  podeReceber,
  detalheAutomacao,
  dataEmBrasilia,
  modoSimulado,
} from "./regras.ts";

test("rascunho parado: avisa com 1 e 3 dias, nos outros dias não", () => {
  const hoje = "2026-10-20";
  assert.equal(avisoAnuncioIncompleto("2026-10-19T15:00:00Z", hoje), 1);
  assert.equal(avisoAnuncioIncompleto("2026-10-17T15:00:00Z", hoje), 3);
  assert.equal(avisoAnuncioIncompleto("2026-10-20T15:00:00Z", hoje), null);
  assert.equal(avisoAnuncioIncompleto("2026-10-18T15:00:00Z", hoje), null);
  assert.equal(avisoAnuncioIncompleto("2026-10-10T15:00:00Z", hoje), null);
});

test("a data do rascunho conta em Brasília (02h UTC ainda é o dia anterior)", () => {
  assert.equal(dataEmBrasilia("2026-10-19T02:00:00Z"), "2026-10-18");
  assert.equal(avisoAnuncioIncompleto("2026-10-19T02:00:00Z", "2026-10-21"), 3);
});

test("saída 3 dias antes, avaliação 1 dia depois, renovação 15 dias antes", () => {
  assert.equal(lembreteDeSaida("2026-10-23", "2026-10-20"), true);
  assert.equal(lembreteDeSaida("2026-10-22", "2026-10-20"), false);
  assert.equal(pedirAvaliacao("2026-10-19", "2026-10-20"), true);
  assert.equal(pedirAvaliacao("2026-10-20", "2026-10-20"), false);
  assert.equal(avisarRenovacao("2026-11-04", "2026-10-20"), true);
  assert.equal(avisarRenovacao("2026-11-03", "2026-10-20"), false);
});

test("a chave de envio é estável e distingue pessoa e variante", () => {
  const a = chaveEnvio("anuncio_incompleto", "p1", "u1", "3");
  assert.equal(a, "anuncio_incompleto:p1:u1:3");
  assert.notEqual(a, chaveEnvio("anuncio_incompleto", "p1", "u1", "1"));
  assert.notEqual(chaveEnvio("saida_lembrete", "c1", "u1"), chaveEnvio("saida_lembrete", "c1", "u2"));
});

test("quem desligou os avisos ou não tem e-mail não recebe", () => {
  assert.equal(podeReceber({ email: "a@b.com" }), true);
  assert.equal(podeReceber({ email: "a@b.com", notif_email: null }), true);
  assert.equal(podeReceber({ email: "a@b.com", notif_email: false }), false);
  assert.equal(podeReceber({ email: "" }), false);
  assert.equal(podeReceber(null), false);
});

test("textos seguem o vocabulário da Viva (sem aluguel, comissão, vistoria, temporada)", () => {
  const tipos = ["anuncio_incompleto", "saida_lembrete", "avaliacao_pedido", "renovacao_aviso"] as const;
  for (const t of tipos) {
    const txt = detalheAutomacao(t, { imovel: "Apartamento no Centro", fim: "2026-11-04", dias: 3 });
    assert.ok(txt.length > 20, t);
    assert.doesNotMatch(txt, /alugu|comiss|corretag|intermedi|vistoria|temporada|hóspede/i, t);
  }
  assert.match(detalheAutomacao("saida_lembrete", { fim: "2026-11-04" }), /04\/11\/2026/);
  assert.match(detalheAutomacao("saida_lembrete", {}), /conferência de saída/);
});

test("cron de automações só envia de verdade com AUTOMACOES_ATIVO=1 (trava do Moacir, #658)", () => {
  assert.equal(modoSimulado(null, undefined), true);
  assert.equal(modoSimulado(null, ""), true);
  assert.equal(modoSimulado(null, "0"), true);
  assert.equal(modoSimulado(null, "true"), true);
  assert.equal(modoSimulado("1", "1"), true); // ?simular=1 sempre vence
  assert.equal(modoSimulado(null, "1"), false);
});
