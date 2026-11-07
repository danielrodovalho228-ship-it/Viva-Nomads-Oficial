/*
  Achado 173 — pedido do parceiro (aceitar, recusar, cancelar, concluir, avaliar, baixar arquivo): o carregamento do
  pedido não olhava o erro; com o banco falhando cliente e parceiro liam "Pedido não encontrado.".
  Roda: node --test src/lib/parceiros/achado173-pedido-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./pedido-actions.ts", import.meta.url), "utf8");

test("carregar o pedido: destrincha o erro antes de 'Pedido não encontrado'", () => {
  assert.match(src, /const \{ data, error: erroPedido \} = await s\.admin\.from\("parceiro_pedidos"\)\.select\(COLUNAS\)/);
  assert.match(src, /if \(erroPedido\) return \{ erro: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*const p = data as unknown as LinhaPedido \| null;/);
});

test("arquivo do pedido: falha na leitura da entrega não vira 'Arquivo não encontrado'", () => {
  assert.match(src, /const \{ data, error: erroEntrega \} = await c\.admin\.from\("parceiro_entregas"\)/);
  assert.match(src, /if \(erroEntrega\) return \{ ok: false, erro: "Não foi possível abrir o arquivo agora\. Tente de novo\." \};/);
});
