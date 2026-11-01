/*
  Achado 33 (frente erros/estados vazios): /admin/servicos não pode dizer "Nenhum pedido de serviço dos moradores
  ainda" (com "Pedidos novos" = 0) quando a leitura falha. O erro sobe e cai no error.tsx do admin ("Tentar de novo").
  Roda: node --test src/lib/servicos-morador-achado33.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("pedidosServicoAdmin lança no erro de leitura", () => {
  const s = readFileSync(new URL("./data/servicos-morador-actions.ts", import.meta.url), "utf8");
  const corpo = s.slice(s.indexOf("export async function pedidosServicoAdmin"), s.indexOf("export async function atualizarEstadoPedidoServico"));
  assert.match(corpo, /const \{ data, error \} = await admin/);
  assert.match(corpo, /if \(error\) throw new Error/);
});

test("a página não engole o erro (sem catch que devolva lista vazia)", () => {
  const p = readFileSync(new URL("../app/(dashboard)/admin/servicos/page.tsx", import.meta.url), "utf8");
  assert.match(p, /const pedidos = await pedidosServicoAdmin\(\);/);
  assert.doesNotMatch(p, /pedidosServicoAdmin\(\)\.catch/);
});
