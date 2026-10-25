import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (p: string) => readFileSync(p, "utf8");

// Ordem cfeb4105: pedido ativo anterior ao cálculo (compativeis_ao_publicar nulo) é recalculado uma vez pelo disparo diário.
test("o disparo diário recalcula só pedidos ativos sem cálculo, com limite", () => {
  const compat = ler("src/lib/data/pedidos-compat.ts");
  const corpo = compat.slice(compat.indexOf("export async function recalcularPedidosSemCalculo"));
  assert.match(corpo, /\.eq\("status", "ativo"\)/);
  assert.match(corpo, /\.is\("compativeis_ao_publicar", null\)/);
  assert.match(corpo, /\.limit\(limite\)/);
  // usa a mesma função da publicação (grava a coluna e o aviso), sem duplicar a regra
  assert.match(corpo, /await avisarCompativeisDoPedido\(p\.id\)/);
});

test("a rota do cron chama o recálculo antes do resumo e uma falha não derruba o resumo", () => {
  const rota = ler("src/app/api/cron/resumo-pedidos/route.ts");
  assert.match(rota, /recalcularPedidosSemCalculo\(\)\.catch/);
  assert.ok(rota.indexOf("recalcularPedidosSemCalculo()") < rota.indexOf("enviarResumosDiarios()"));
  // continua exigindo o segredo
  assert.match(rota, /Bearer \$\{segredo\}/);
});
