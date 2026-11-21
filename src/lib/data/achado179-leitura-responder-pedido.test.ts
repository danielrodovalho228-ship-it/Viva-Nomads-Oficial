import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 179 (varredura "leitura que falha não vira outra resposta"): responderPedido lia o pedido e o imóvel sem olhar o
 * erro — a falha virava "Pedido não está mais disponível" / "Selecione um imóvel seu", dizendo ao dono que o pedido sumiu.
 */
const fonte = readFileSync(new URL("./pedidos-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function responderPedido(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("responderPedido: leitura do pedido com erro responde 'não foi possível ler' antes de 'não está mais disponível'", () => {
  assert.match(f, /const \{ data: pedido, error: erroPedido \} = await supabase\s*\.from\("pedidos_publicos"\)/);
  const g = f.indexOf("if (erroPedido)");
  assert.ok(g >= 0);
  assert.match(f.slice(g, g + 120), /Não foi possível ler o pedido agora/);
  assert.ok(g < f.indexOf("Pedido não está mais disponível."));
});

test("responderPedido: leitura do imóvel com erro não vira 'Selecione um imóvel seu'", () => {
  assert.match(f, /const \{ data: imovel, error: erroImovel \} = await supabase\s*\.from\("properties"\)/);
  const g = f.indexOf("if (erroImovel)");
  assert.ok(g >= 0);
  assert.match(f.slice(g, g + 120), /Não foi possível ler o imóvel agora/);
  assert.ok(g < f.indexOf("Selecione um imóvel seu."));
});
