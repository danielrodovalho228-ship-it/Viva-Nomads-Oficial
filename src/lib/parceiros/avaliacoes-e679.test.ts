/* E679-B parte 2 — avaliação do parceiro igual à da estadia. Roda: node --test src/lib/parceiros/avaliacoes-e679.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { podeLerAvaliacaoDoPedido } from "../avaliacoes-criterios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const acoes = ler("src/lib/parceiros/pedido-actions.ts");
const rota = ler("src/app/api/parceiros/pedidos/[id]/route.ts");
const revisao = ler("src/lib/data/avaliacoes-resposta-actions.ts");
const central = ler("src/lib/data/central-pendencias.ts");
const fn = (nome: string) => {
  const i = acoes.indexOf(`export async function ${nome}`);
  assert.ok(i >= 0, `${nome} não existe`);
  const j = acoes.indexOf("\nexport ", i + 10);
  return acoes.slice(i, j < 0 ? undefined : j);
};

test("a nota do parceiro sobre o cliente NUNCA é lida pelo cliente avaliado, nem como 'cliente' em outro contexto", () => {
  assert.equal(podeLerAvaliacaoDoPedido("cliente", "parceiro"), false);
  assert.equal(podeLerAvaliacaoDoPedido("cliente", "cliente"), true);
  assert.equal(podeLerAvaliacaoDoPedido("parceiro", "cliente"), true);
});

test("avaliarPedido: critérios do par, etiquetas, recomendaria e notas privadas; a moderação vem do banco", () => {
  const f = fn("avaliarPedido");
  assert.match(f, /validarAvaliacaoCompleta\(/);
  assert.match(f, /cliente_avalia_parceiro/);
  assert.match(f, /parceiro_avalia_cliente/);
  for (const c of ["notas_categorias", "etiquetas", "recomendaria", "nota_privada_parte", "nota_privada_viva"]) assert.match(f, new RegExp(c));
  assert.doesNotMatch(f, /guardContactInfo/);
  assert.match(f, /publicar_avaliacoes_parceiro/);
});

test("detalheDoPedido: o cliente não recebe a nota do parceiro; o parceiro recebe a do cliente com a resposta e a revisão", () => {
  const f = fn("detalheDoPedido");
  assert.match(f, /podeLerAvaliacaoDoPedido\(/);
  assert.match(f, /avaliacaoRecebida/);
  assert.match(f, /avaliacao_respostas/);
  assert.match(f, /avaliacao_contestacoes/);
});

test("resposta pública e revisão do parceiro: mesma trilha, só o parceiro avaliado, uma resposta", () => {
  const r = fn("responderAvaliacaoDoPedido");
  assert.match(r, /papel !== "parceiro"/);
  assert.match(r, /validarResposta\(/);
  assert.match(r, /from\("avaliacao_respostas"\)/);
  assert.match(r, /parceiro_avaliacao_id/);
  const c = fn("pedirRevisaoDoPedido");
  assert.match(c, /papel !== "parceiro"/);
  assert.match(c, /validarContestacao\(/);
  assert.match(c, /validarFatoFalso\(/);
  assert.match(c, /from\("avaliacao_contestacoes"\)/);
});

test("a rota do pedido expõe avaliar (com critérios), responder e pedir revisão", () => {
  assert.match(rota, /criterios/);
  assert.match(rota, /"responder-avaliacao"/);
  assert.match(rota, /"revisar-avaliacao"/);
});

test("admin: a decisão cobre avaliação de parceiro e recalcula a nota da página do parceiro; a fila mostra as duas", () => {
  assert.match(revisao, /parceiro_avaliacao_id/);
  assert.match(revisao, /from\("parceiro_avaliacoes"\)/);
  assert.match(revisao, /publicar_avaliacoes_parceiro/);
  assert.match(central, /parceiro_avaliacoes\(/);
});
