/**
 * E460 (resíduo, varredura completa de 08/11): o menu do parceiro (Início · Pedidos · Agenda · Ganhos · Mensagens) foi
 * conferido tela a tela. Esta guarda fixa o resultado: nenhuma rota do painel acende uma aba que não é a dela — em
 * especial "Pedidos" só acende nas telas de pedido de serviço, nunca "em toda parte" (o defeito original). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ABAS_PARCEIRO, abaAtivaPainel } from "./abas-painel.ts";

const ativa = (rota: string, secao: string | null = null) => abaAtivaPainel(ABAS_PARCEIRO, rota, secao)?.id ?? null;

test("as telas do painel do parceiro acendem a área certa, qualquer que seja a seção guardada", () => {
  for (const secao of [null, "pedidos", "agenda", "ganhos"]) {
    assert.equal(ativa("/dashboard/parceiro/avaliacao", secao), "inicio", `avaliação, seção ${secao}`);
    assert.equal(ativa("/dashboard/parceiro/avaliacao/abc", secao), "inicio");
    assert.equal(ativa("/dashboard/servicos/pedidos/abc", secao), "pedidos");
    assert.equal(ativa("/dashboard/mensagens", secao), "mensagens");
    assert.equal(ativa("/dashboard/mensagens/abc", secao), "mensagens");
  }
});

test("as telas que não são do menu do parceiro não acendem aba nenhuma (e nunca 'Pedidos')", () => {
  const fora = ["/dashboard/servicos", "/dashboard/ganhos", "/dashboard/agenda", "/dashboard/carteira", "/dashboard/recibos", "/dashboard/reembolsos", "/dashboard/orcamentos", "/dashboard/orcamentos/nova", "/dashboard/respostas-rapidas", "/dashboard/pedidos-cidade", "/dashboard/pedidos", "/dashboard/avaliacoes", "/dashboard/avaliacoes/responder/x", "/dashboard/conta", "/dashboard/conta/perfil", "/dashboard/notificacoes", "/dashboard/verificacao", "/dashboard/visitas", "/dashboard/ferramentas", "/dashboard/solicitacoes"];
  for (const rota of fora) {
    assert.equal(ativa(rota), null, rota);
    assert.equal(ativa(rota, "pedidos"), null, `${rota} com a seção "pedidos" guardada`);
  }
});

test("na raiz do painel a aba é a seção visível; sem seção medida, Início", () => {
  assert.equal(ativa("/dashboard/parceiro"), "inicio");
  assert.equal(ativa("/dashboard/parceiro", "agenda"), "agenda");
  assert.equal(ativa("/dashboard/parceiro", "ganhos"), "ganhos");
});
