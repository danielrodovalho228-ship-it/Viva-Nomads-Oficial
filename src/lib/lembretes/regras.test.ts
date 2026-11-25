/* Roda: node --test src/lib/lembretes/regras.test.ts — Prompt 50: lembretes honestos e o silêncio 22h–7h. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chamadoForaDaPromessa, emSilencio, estadoDoChamado, parceiroSemResposta, proximoEnvioPermitido, rascunhoParado, textoRascunho, verificacaoParada } from "./regras.ts";
import { MOTIVOS_VERIFICACAO, motivoDaReprovacao, proximaAcaoVerificacao } from "../../config/verificacao-motivos.ts";

const brt = (iso: string) => new Date(`${iso}-03:00`);

test("silêncio das 22h às 7h (Brasília) e a próxima saída", () => {
  assert.equal(emSilencio(brt("2026-10-23T21:59:00")), false);
  assert.equal(emSilencio(brt("2026-10-23T22:00:00")), true);
  assert.equal(emSilencio(brt("2026-10-24T06:59:00")), true);
  assert.equal(emSilencio(brt("2026-10-24T07:00:00")), false);
  assert.equal(proximoEnvioPermitido(brt("2026-10-23T23:30:00")).toISOString(), "2026-10-24T10:00:00.000Z");
  assert.equal(proximoEnvioPermitido(brt("2026-10-24T03:00:00")).toISOString(), "2026-10-24T10:00:00.000Z");
  const dia = brt("2026-10-24T09:00:00");
  assert.equal(proximoEnvioPermitido(dia), dia);
  // Nenhuma hora do silêncio passa.
  for (let h = 0; h < 24; h++) {
    const d = brt(`2026-10-24T${String(h).padStart(2, "0")}:30:00`);
    assert.equal(emSilencio(proximoEnvioPermitido(d)), false, `hora ${h}`);
  }
});

test("rascunho parado 3 dias; texto com os passos", () => {
  assert.equal(rascunhoParado("2026-10-20T12:00:00Z", new Date("2026-10-23T11:59:00Z")), false);
  assert.equal(rascunhoParado("2026-10-20T12:00:00Z", new Date("2026-10-23T12:00:00Z")), true);
  assert.equal(textoRascunho(3, "Studio Centro"), "Faltam 3 passos para publicar Studio Centro");
  assert.equal(textoRascunho(1, "Studio Centro"), "Falta 1 passo para publicar Studio Centro");
  assert.equal(textoRascunho(2, " "), "Faltam 2 passos para publicar seu imóvel");
});

test("parceiro sem resposta em 1 dia útil (fim de semana não conta)", () => {
  // Sexta 10h → segunda 10h.
  assert.equal(parceiroSemResposta("2026-10-23T13:00:00Z", null, new Date("2026-10-26T12:59:00Z")), false);
  assert.equal(parceiroSemResposta("2026-10-23T13:00:00Z", null, new Date("2026-10-26T13:01:00Z")), true);
  assert.equal(parceiroSemResposta("2026-10-23T13:00:00Z", "2026-10-23T15:00:00Z", new Date("2026-10-28T00:00:00Z")), false);
});

test("verificação parada 24 h e chamado fora da promessa", () => {
  const t = { em: "2026-10-22T12:00:00Z", ok: false };
  assert.equal(verificacaoParada(t, false, new Date("2026-10-23T11:00:00Z")), false);
  assert.equal(verificacaoParada(t, false, new Date("2026-10-23T12:00:00Z")), true);
  assert.equal(verificacaoParada(t, true, new Date("2026-10-23T12:00:00Z")), false);
  assert.equal(verificacaoParada(null, false, new Date("2026-10-23T12:00:00Z")), false);
  const c = { criadoEm: "2026-10-22T12:00:00Z", primeiraRespostaEm: null, resolvido: false };
  assert.equal(chamadoForaDaPromessa(c, new Date("2026-10-23T12:00:00Z")), false);
  assert.equal(chamadoForaDaPromessa(c, new Date("2026-10-23T12:01:00Z")), true);
  assert.equal(chamadoForaDaPromessa({ ...c, primeiraRespostaEm: "2026-10-22T13:00:00Z" }, new Date("2026-10-24T00:00:00Z")), false);
  assert.equal(estadoDoChamado({ status: "aberto", primeiraRespostaEm: null }), "aberto");
  assert.equal(estadoDoChamado({ status: "em_andamento", primeiraRespostaEm: "x" }), "respondido");
  assert.equal(estadoDoChamado({ status: "encerrado", primeiraRespostaEm: null }), "resolvido");
});

test("verificação: cada motivo tem texto e próximo passo; nenhum genérico; 2ª reprovação → pessoa", () => {
  const GENERICO = /falha na verifica|erro|tente novamente mais tarde|algo deu errado/i;
  for (const [k, t] of Object.entries(MOTIVOS_VERIFICACAO)) {
    assert.ok(t.titulo.length >= 5 && t.proximoPasso.length >= 20, k);
    assert.doesNotMatch(`${t.titulo} ${t.proximoPasso}`, GENERICO, k);
  }
  assert.equal(MOTIVOS_VERIFICACAO.foto_escura.proximoPasso.includes("janela"), true);
  assert.equal(motivoDaReprovacao({ light: "green", identity: true, liveness: true, document: true }), null);
  assert.equal(motivoDaReprovacao({ document: false, notes: ["Imagem escura"] }), "foto_escura");
  assert.equal(motivoDaReprovacao({ document: false, notes: ["documento borrado"] }), "documento_ilegivel");
  assert.equal(motivoDaReprovacao({ document: false }), "documento_nao_reconhecido");
  assert.equal(motivoDaReprovacao({ document: true, liveness: false }), "prova_de_vida");
  assert.equal(motivoDaReprovacao({ document: true, liveness: true, identity: false }), "selfie_nao_confere");
  assert.equal(motivoDaReprovacao({ receitaConfere: false }), "cpf_nao_confere");
  assert.equal(motivoDaReprovacao({ ocrConfere: false }), "nome_nao_confere");
  assert.equal(motivoDaReprovacao({ pendente: true }), "em_analise");
  assert.equal(proximaAcaoVerificacao(0), null);
  assert.equal(proximaAcaoVerificacao(1), "tentar_de_novo");
  assert.equal(proximaAcaoVerificacao(2), "analise_humana");
  assert.equal(proximaAcaoVerificacao(3), "analise_humana");
});
