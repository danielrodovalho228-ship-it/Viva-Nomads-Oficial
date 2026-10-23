import { test } from "node:test";
import assert from "node:assert/strict";
import { conversaAbertaRecente, decisaoDoPush, eventoTemPush, grupoDaConversa, textoMensagensAgrupadas } from "./regra-push.ts";
import { emSilencio, furaOSilencio, proximoEnvioPermitido } from "./silencio.ts";

// 15h e 23h30 em Brasília (UTC−3).
const DIA = new Date("2026-10-23T18:00:00Z");
const NOITE = new Date("2026-10-24T02:30:00Z");

test("silêncio único: 22h–7h em Brasília; volta às 7h; só segurança e prazo do dia furam", () => {
  assert.equal(emSilencio(DIA), false);
  assert.equal(emSilencio(NOITE), true);
  assert.equal(emSilencio(new Date("2026-10-24T09:59:00Z")), true); // 6h59
  assert.equal(emSilencio(new Date("2026-10-24T10:00:00Z")), false); // 7h
  assert.equal(proximoEnvioPermitido(NOITE).toISOString(), "2026-10-24T10:00:00.000Z");
  assert.equal(proximoEnvioPermitido(DIA), DIA);
  assert.equal(furaOSilencio({ seguranca: true }), true);
  assert.equal(furaOSilencio({ seguranca: false, prazoHoje: true }), true);
  assert.equal(furaOSilencio({ seguranca: false }), false);
});

test("a matriz decide: sem canal push ou fora da matriz, nunca push", () => {
  assert.equal(eventoTemPush("proposta_recebida"), true);
  assert.equal(eventoTemPush("documento_aprovado"), false);
  assert.equal(eventoTemPush("evento_inventado"), false);
  assert.deepEqual(decisaoDoPush({ evento: "documento_aprovado", agora: DIA }), { tipo: "nao", motivo: "sem_push" });
  assert.deepEqual(decisaoDoPush({ evento: "evento_inventado", agora: DIA }), { tipo: "nao", motivo: "fora_da_matriz" });
  assert.deepEqual(decisaoDoPush({ evento: "proposta_recebida", agora: DIA }), { tipo: "enviar" });
});

test("22h30: decisão espera as 7h; segurança e prazo do dia saem; só e-mail continua sem push", () => {
  assert.deepEqual(decisaoDoPush({ evento: "proposta_recebida", agora: NOITE }), { tipo: "adiar", ate: new Date("2026-10-24T10:00:00Z") });
  assert.deepEqual(decisaoDoPush({ evento: "verification_ready", agora: NOITE }), { tipo: "enviar" });
  assert.deepEqual(decisaoDoPush({ evento: "manutencao_nova", agora: NOITE, prazoHoje: true }), { tipo: "enviar" });
  assert.equal(decisaoDoPush({ evento: "contract_signature_code", agora: NOITE }).tipo, "nao");
});

test("mensagem nova: sem push com a conversa aberta há menos de 10 min; agrupada e sem texto", () => {
  const ha5 = new Date(DIA.getTime() - 5 * 60_000).toISOString();
  const ha11 = new Date(DIA.getTime() - 11 * 60_000).toISOString();
  assert.equal(conversaAbertaRecente(ha5, DIA), true);
  assert.equal(conversaAbertaRecente(ha11, DIA), false);
  assert.equal(conversaAbertaRecente(null, DIA), false);
  assert.deepEqual(decisaoDoPush({ evento: "new_message", agora: DIA, conversaAbertaEm: ha5 }), { tipo: "nao", motivo: "conversa_aberta" });
  assert.deepEqual(decisaoDoPush({ evento: "new_message", agora: DIA, conversaAbertaEm: ha11 }), { tipo: "enviar" });
  assert.deepEqual(textoMensagensAgrupadas(3, "Ana Paula Souza"), { title: "3 mensagens novas de Ana", body: "Abra a conversa para ler e responder." });
  assert.equal(textoMensagensAgrupadas(1, "ana@x.com").title, "Nova mensagem");
  assert.equal(grupoDaConversa("c1"), "conversa:c1");
});

test("texto da decisão: valor só para quem é parte, prazo relativo, sem contato nem documento", async () => {
  const { textoDaDecisao, prazoRelativo } = await import("./regra-push.ts");
  const amanha = new Date(DIA.getTime() + 86_400_000).toISOString();
  assert.equal(
    textoDaDecisao("proposta_recebida", { imovel: "Apto Santa Mônica", valor: 3200, prazo: amanha, destinatarioEhParte: true }, DIA),
    "Nova proposta de R$ 3.200 para o Apto Santa Mônica: responda até amanhã",
  );
  assert.equal(textoDaDecisao("proposta_recebida", { imovel: "Apto Santa Mônica", valor: 3200, destinatarioEhParte: false }, DIA), "Nova proposta para o Apto Santa Mônica");
  assert.equal(textoDaDecisao("proposta_recebida", { imovel: "Apto ana@x.com 12345678901", destinatarioEhParte: true }, DIA), "Nova proposta para o Apto");
  assert.equal(textoDaDecisao("documento_aprovado", { destinatarioEhParte: true }, DIA), null);
  assert.equal(prazoRelativo(DIA.toISOString(), DIA), "hoje");
  assert.equal(prazoRelativo("2026-10-30T15:00:00Z", DIA), "30/10");
  assert.equal(prazoRelativo(null, DIA), null);
});
