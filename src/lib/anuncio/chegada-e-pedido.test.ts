import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISO_SEM_TIPO_ENTRADA,
  CONVIDADO_NUNCA_VE,
  CONVIDADO_VE,
  LIMITE_CONSIDERAR_TEXTO,
  LIMITE_MENSAGEM_PEDIDO,
  avisoTipoEntradaNoPainel,
  considerarPreenchido,
  convidadoVence,
  limiteConvidados,
  mensagemParaExibir,
  mostraClasseDeRuido,
  podeConvidar,
  rotuloTipoEntrada,
  tipoEntradaBloqueia,
  tipoEntradaValido,
  validarConsiderar,
  validarMensagemParaPedido,
} from "./chegada-e-pedido.ts";

test("tipo de entrada: só as chaves da lista; o rótulo não carrega código nem local", () => {
  assert.equal(tipoEntradaValido("cofre_de_chaves"), true);
  assert.equal(tipoEntradaValido("cofre na caixa de luz, senha 1234"), false);
  assert.equal(tipoEntradaValido(null), false);
  assert.equal(rotuloTipoEntrada("fechadura_com_codigo"), "Fechadura com código");
  assert.equal(rotuloTipoEntrada("xyz"), null);
});

test("tipo de entrada: obrigatório só para publicar anúncio novo; publicado sem ele ganha aviso, sem bloqueio", () => {
  assert.equal(tipoEntradaBloqueia({ tipoEntrada: null, jaPublicado: false }), true);
  assert.equal(tipoEntradaBloqueia({ tipoEntrada: "porteiro", jaPublicado: false }), false);
  assert.equal(tipoEntradaBloqueia({ tipoEntrada: null, jaPublicado: true }), false);
  assert.equal(avisoTipoEntradaNoPainel({ tipoEntrada: null, status: "active" }), AVISO_SEM_TIPO_ENTRADA);
  assert.equal(avisoTipoEntradaNoPainel({ tipoEntrada: null, status: "draft" }), null);
  assert.equal(avisoTipoEntradaNoPainel({ tipoEntrada: "outro", status: "active" }), null);
});

test("mensagem para quem pede: até 500, contato mascarado ao salvar e ao exibir", () => {
  assert.deepEqual(validarMensagemParaPedido("   "), { ok: true, valor: null, mascarou: false });
  const r = validarMensagemParaPedido("Prefiro quem fica 3 meses. Me chama no 11 99876-5432 ou ana@exemplo.com");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.mascarou, true);
    assert.doesNotMatch(r.valor ?? "", /99876|ana@exemplo/);
  }
  assert.equal(validarMensagemParaPedido("a".repeat(LIMITE_MENSAGEM_PEDIDO)).ok, true);
  assert.equal(validarMensagemParaPedido("a".repeat(LIMITE_MENSAGEM_PEDIDO + 1)).ok, false);
  // texto gravado por outro caminho nunca exibe contato
  assert.doesNotMatch(mensagemParaExibir("whats 11 99876-5432") ?? "", /99876/);
  assert.equal(mensagemParaExibir(""), null);
});

test("o que considerar: filtra a lista, limita o texto, soma quando preenchido e nunca bloqueia vazio", () => {
  const r = validarConsiderar(["barulho", "barulho", "piscina", "escada"], "  Rua de bares às sextas ");
  assert.deepEqual(r, { ok: true, itens: ["barulho", "escada"], texto: "Rua de bares às sextas" });
  assert.deepEqual(validarConsiderar(undefined, null), { ok: true, itens: [], texto: null });
  assert.equal(validarConsiderar([], "x".repeat(LIMITE_CONSIDERAR_TEXTO + 1)).ok, false);
  assert.equal(considerarPreenchido({ itens: [], texto: "" }), false);
  assert.equal(considerarPreenchido({ itens: ["obra"] }), true);
  assert.equal(considerarPreenchido({ texto: "Escada estreita" }), true);
  assert.equal(mostraClasseDeRuido(["barulho"]), true);
  assert.equal(mostraClasseDeRuido(["obra"]), false);
});

test("convidar quem mora junto: até ocupantes − 1, sem repetir nem convidar a si mesmo", () => {
  assert.equal(limiteConvidados(1), 0);
  assert.equal(limiteConvidados(3), 2);
  assert.equal(limiteConvidados(null), 0);
  const base = { qtdOcupantes: 3, ativos: 0, jaConvidados: [] as string[], emailDoMorador: "eu@x.com" };
  assert.deepEqual(podeConvidar({ ...base, email: "Bia@X.com" }), { ok: true });
  assert.equal(podeConvidar({ ...base, email: "eu@x.com" }).ok, false);
  assert.equal(podeConvidar({ ...base, email: "bia@x.com", jaConvidados: ["BIA@x.com"] }).ok, false);
  assert.equal(podeConvidar({ ...base, email: "nao-e-email" }).ok, false);
  const cheio = podeConvidar({ ...base, ativos: 2, email: "c@x.com" });
  assert.equal(cheio.ok, false);
  const sozinho = podeConvidar({ ...base, qtdOcupantes: 1, email: "c@x.com" });
  assert.equal(sozinho.ok, false);
});

test("convidado: só leitura do que precisa; valores, contrato e conversa nunca", () => {
  for (const c of CONVIDADO_VE) assert.equal((CONVIDADO_NUNCA_VE as readonly string[]).includes(c), false);
  assert.ok(CONVIDADO_NUNCA_VE.includes("valores"));
  assert.ok(CONVIDADO_NUNCA_VE.includes("conversa"));
  assert.equal(convidadoVence("2026-12-01T00:00:00Z")?.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.equal(convidadoVence(null), null);
  assert.equal(convidadoVence("lixo"), null);
});
