/**
 * E460 (PC4): o menu do parceiro sublinhava "Pedidos" em toda parte — em /dashboard/parceiro (topo) e em
 * /dashboard/parceiro/avaliacao. Esperado: a ÁREA atual. Regra única (ancoraAtiva) para o topo do computador e a barra
 * do celular: na raiz do painel do parceiro, a seção visível (sem seção medida: Início, o topo — E459); numa subpágina
 * do painel (avaliação), Início — a área do painel do parceiro, nunca a seção que ficou para trás. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABAS_PARCEIRO, abaAtivaPainel, ancoraAtiva } from "./abas-painel.ts";

test("raiz do painel: a seção visível; sem seção, Início", () => {
  assert.equal(ancoraAtiva(ABAS_PARCEIRO, "/dashboard/parceiro", null), "inicio");
  assert.equal(ancoraAtiva(ABAS_PARCEIRO, "/dashboard/parceiro", "agenda"), "agenda");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", null)?.id, "inicio");
});

test("subpágina do painel (avaliação): Início, mesmo com a seção de antes guardada", () => {
  assert.equal(ancoraAtiva(ABAS_PARCEIRO, "/dashboard/parceiro/avaliacao", "pedidos"), "inicio");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro/avaliacao", "pedidos")?.id, "inicio");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro/avaliacao/abc", null)?.id, "inicio");
});

test("fora do painel do parceiro: nenhuma âncora; Pedidos só nas telas de pedido (ativoEm)", () => {
  assert.equal(ancoraAtiva(ABAS_PARCEIRO, "/dashboard/mensagens", "pedidos"), null);
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/servicos/pedidos/x", "ganhos")?.id, "pedidos");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/mensagens", null)?.id, "mensagens");
});

test("a barra do celular usa a mesma regra (sem 'pedidos' fixo) e a seção vale só na raiz", () => {
  const barra = readFileSync(new URL("../components/layout/mobile-tab-bar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(barra, /secao \?\? "pedidos"/);
  assert.match(barra, /if \(ancora\) return ancoraAtiva\(tabs, pathname, secao\) === ancora;/);
  const hook = readFileSync(new URL("../components/layout/use-secao-ancora.ts", import.meta.url), "utf8");
  assert.match(hook, /return pathname === rota \? secao : null;/);
});
