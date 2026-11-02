/*
  Resíduo da varredura de funções — atualizarPedidoEncerramento (médio-baixo): a equipe conduz ou conclui o pedido de
  encerramento de um contrato. (1) A leitura do pedido não conferia o erro: na falha, "Pedido não encontrado". (2) A
  troca de status do pedido não conferia o resultado: se falhasse, ou se outra conclusão ganhasse a corrida (duplo
  clique), o fluxo seguia — contrato encerrado, evento, documento de encerramento (registrarEncerramento), serviços e
  mensagens cancelados — em dobro. Agora a leitura que falha diz "tente de novo", e a troca de status vale UMA vez:
  sem a linha trocada, nada mais acontece.
  Roda: node --test src/lib/estadia/residuo-pedido-encerramento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../data/estadia-actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function atualizarPedidoEncerramento"), src.indexOf("\n}\n", src.indexOf("export async function atualizarPedidoEncerramento")));

test("leitura do pedido que falha → 'tente de novo', nunca 'não encontrado'", () => {
  assert.match(fn, /const \{ data: p, error: erroPedido \} = await admin\.from\("contrato_encerramento_pedidos"\)/);
  assert.ok(fn.indexOf("if (erroPedido) return { ok: false, erro: MSG_ENCERRAMENTO_SEM_LEITURA };") < fn.indexOf('"Pedido não encontrado ou já concluído."'));
});

test("a troca de status vale uma vez: sem a linha trocada, não encerra, não registra, não cancela", () => {
  assert.match(fn, /const \{ data: trocou, error: erroTroca \} = await admin\.from\("contrato_encerramento_pedidos"\)\.update\(\{ status, atualizado_em: new Date\(\)\.toISOString\(\) \}\)\.eq\("id", pedido\.id\)\.neq\("status", "concluido"\)\.select\("id"\);/);
  const guarda = fn.indexOf("if (erroTroca) return { ok: false, erro: MSG_ENCERRAMENTO_SEM_LEITURA };");
  const corrida = fn.indexOf('if (!trocou?.length) return { ok: false, erro: "Pedido não encontrado ou já concluído." };');
  const efeitos = fn.indexOf('.from("contratos").update(');
  assert.ok(guarda > 0 && corrida > 0 && guarda < efeitos && corrida < efeitos, "as guardas vêm antes de encerrar o contrato");
  assert.ok(corrida < fn.indexOf("registrarEncerramento("));
});
