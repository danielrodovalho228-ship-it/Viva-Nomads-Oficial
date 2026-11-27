/**
 * E468 (PC12): na página de Notificações, "Solicitações" levava todo mundo a /dashboard/solicitacoes — a manutenção do
 * dono e do morador. No papel PARCEIRO, a tela abria vazia e com o menu do parceiro em cima (papéis misturados). Agora o
 * destino segue o papel ativo (o mesmo do cabeçalho): parceiro → os Pedidos do painel dele; dono/morador → Solicitações.
 * `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoManutencao } from "./manutencao-papel.ts";

test("parceiro vai aos Pedidos do painel dele; dono e morador, às Solicitações", () => {
  assert.deepEqual(destinoManutencao("parceiro"), { href: "/dashboard/parceiro#pedidos", rotulo: "Pedidos", texto: "Nenhuma atualização por enquanto. Os pedidos de serviço ficam em" });
  for (const p of ["proprietario", "morador", null] as const)
    assert.deepEqual(destinoManutencao(p), { href: "/dashboard/solicitacoes", rotulo: "Solicitações", texto: "Nenhuma atualização por enquanto. As ordens de manutenção ficam em" });
});

test("a página de Notificações: o 'Solicitações' do vazio segue o papel; o 'Abrir' de cada ordem continua nela", () => {
  const pg = readFileSync(new URL("../../app/(dashboard)/dashboard/notificacoes/page.tsx", import.meta.url), "utf8");
  assert.match(pg, /<TextoManutencaoVazia \/>/);
  assert.doesNotMatch(pg, /As ordens de manutenção ficam em/);
  assert.equal(pg.match(/href="\/dashboard\/solicitacoes"/g)?.length, 1, "só o 'Abrir' de cada ordem");
});
