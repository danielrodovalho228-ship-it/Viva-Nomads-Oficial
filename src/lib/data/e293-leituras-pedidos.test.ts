// Frente "erros/estados vazios": leitura que falha não vira "vazio" nem "não disponível" nos pedidos de moradia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./pedidos-actions.ts", import.meta.url), "utf8");

test("getRespostasRecebidas não troca falha de leitura por lista vazia", () => {
  const bloco = src.slice(src.indexOf("export async function getRespostasRecebidas"), src.indexOf("export async function aceitarResposta"));
  assert.match(bloco, /const \{ data, error \} = await supabase/);
  assert.match(bloco, /if \(error\) throw new Error\(/);
});

test("responderPedido separa erro de leitura de 'não disponível' e de 'selecione um imóvel seu'", () => {
  assert.match(src, /erroPedido\) return \{ ok: false, error: "Não foi possível ler o pedido agora/);
  assert.match(src, /erroImovel\) return \{ ok: false, error: "Não foi possível ler o imóvel agora/);
  assert.ok(src.indexOf("if (erroPedido)") < src.indexOf('"Pedido não está mais disponível."'));
  assert.ok(src.indexOf("if (erroImovel)") < src.indexOf('"Selecione um imóvel seu."'));
});
