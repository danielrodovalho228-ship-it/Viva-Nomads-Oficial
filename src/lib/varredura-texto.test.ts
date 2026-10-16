/* Roda: node --test src/lib/varredura-texto.test.ts */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CAUCAO_FRASE } from "./faixas.ts";
import { achadosNasMetas, achadosNoTexto, recursoFicticioDoLab, rotaVarreLeis, rotaVarreTermos } from "./varredura-texto.ts";

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

test("metas (description/og/twitter) entram na varredura de termos; vazias e repetidas são ignoradas", () => {
  assert.deepEqual(achadosNasMetas(["Imóveis mobiliados em Uberlândia", "", null, undefined]), []);
  const a = achadosNasMetas(["Alugue com comissão zero", "Alugue com comissão zero"]);
  assert.equal(a.length, 1);
  assert.match(a[0], /^meta: termo proibido "comissão"/);
  assert.deepEqual(achadosNasMetas(["comissão"], { termos: false }), []);
});

test("tela de publicar imóvel: citação de lei é achado; nas outras telas não é varrida", () => {
  assert.equal(rotaVarreLeis("/dashboard/imoveis/novo"), true);
  assert.equal(rotaVarreLeis("/dashboard/imoveis/novo?x=1"), true);
  assert.equal(rotaVarreLeis("/dashboard/imoveis"), false);
  const texto = "Conforme a Lei 8.245/91, art. 38 e art. 13";
  assert.equal(achadosNoTexto(texto, { leis: true }).length, 3);
  assert.deepEqual(achadosNoTexto(texto), []);
  assert.deepEqual(achadosNoTexto("Publique seu imóvel mobiliado em 5 passos.", { leis: true }), []);
});
