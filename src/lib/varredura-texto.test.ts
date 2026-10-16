/* Roda: node --test src/lib/varredura-texto.test.ts */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CAUCAO_FRASE } from "./faixas.ts";
import { achadosNoTexto, recursoFicticioDoLab, rotaVarreTermos, rotaVarreVocabulario } from "./varredura-texto.ts";

test("tela limpa não tem achados", () => {
  assert.deepEqual(achadosNoTexto("Valor mensal R$ 3.000. Entrada em 12/11/2026. Código 1a2b3c4d. Aguardando aceite. Conferência de saída."), []);
});

test("pega termos proibidos, com e sem acento", () => {
  for (const t of ["o aluguel", "Aluguéis", "taxa de comissão", "comissao", "vistoria de saída", "corretagem", "intermediação", "intermedeia", "temporada", "art. 48"]) {
    assert.equal(achadosNoTexto(t).length, 1, t);
  }
  assert.deepEqual(achadosNoTexto("Aluguel", { termos: false }), []);
});

test("pega status cru, data ISO, UUID e undefined/NaN", () => {
  assert.equal(achadosNoTexto("Situação: pendente_aceite").length, 1);
  assert.equal(achadosNoTexto("aguardando_assinatura e em_andamento").length, 2);
  assert.equal(achadosNoTexto("Início 2026-11-12").length, 1);
  assert.equal(achadosNoTexto("Criado 2026-11-12T10:30:00").length, 1);
  assert.equal(achadosNoTexto("Contrato 3f2504e0-4f89-11d3-9a0c-0305e82c3301").length, 1);
  assert.equal(achadosNoTexto("Valor: undefined").length, 1);
  assert.equal(achadosNoTexto("R$ NaN").length, 1);
});

test("não confunde palavras comuns", () => {
  assert.deepEqual(achadosNoTexto("Anunciar em andamento. Em breve. Nullable"), []);
  assert.equal(achadosNoTexto("Valor null aqui").length, 1);
});

test("/termos, /privacidade e contratos ficam fora da varredura de termos", () => {
  assert.equal(rotaVarreTermos("/termos"), false);
  assert.equal(rotaVarreTermos("/privacidade?x=1"), false);
  assert.equal(rotaVarreTermos("/como-funciona"), true);
});

test("vocabulário de hospedagem só é pego quando pedido (páginas públicas)", () => {
  for (const t of ["Hóspedes", "Check-in", "check out", "a reserva é fechada", "quem se hospeda"]) {
    assert.equal(achadosNoTexto(t, { vocabulario: true }).length, 1, t);
    assert.deepEqual(achadosNoTexto(t), [], t);
  }
  assert.deepEqual(achadosNoTexto("Moradores. Entrada a partir das 14:00. Saída até as 11:00. Reservado.", { vocabulario: true }), []);
});

test("vocabulário público não vale no painel, admin, /seguranca, /termos nem contratos", () => {
  assert.equal(rotaVarreVocabulario("/precos"), true);
  assert.equal(rotaVarreVocabulario("/imoveis/abc"), true);
  for (const r of ["/dashboard/locacoes", "/admin", "/seguranca", "/termos", "/privacidade", "/contratos/x"]) {
    assert.equal(rotaVarreVocabulario(r), false, r);
  }
});

test("a frase única da caução (parecer jurídico pendente) não é achado; outro 'aluguel' continua sendo", () => {
  assert.deepEqual(achadosNoTexto(`Garantia. ${CAUCAO_FRASE} Depositada antes da entrada.`), []);
  assert.deepEqual(achadosNoTexto(`Garantia. ${CAUCAO_FRASE.replace(/ /g, "\n")} Fim.`), []);
  assert.equal(achadosNoTexto(`${CAUCAO_FRASE} Seu aluguel sobe.`).length, 1);
});

test("foto fictícia do laboratório não é achado do t48; imagem real quebrada continua sendo", () => {
  const img = (u: string) => `http://localhost:3123/_next/image?url=${encodeURIComponent(u)}&w=640&q=75`;
  assert.equal(recursoFicticioDoLab(img("https://lab.vivanomads.test/storage/v1/object/public/property-photos/a/b-0.png")), true);
  assert.equal(recursoFicticioDoLab(img("https://abc.supabase.co/storage/v1/object/public/property-photos/a.png")), false);
  assert.equal(recursoFicticioDoLab("http://localhost:3123/api/qualquer?url=https://lab.vivanomads.test/x"), false);
  assert.equal(recursoFicticioDoLab(undefined), false);
  assert.equal(recursoFicticioDoLab("não é url"), false);
});
