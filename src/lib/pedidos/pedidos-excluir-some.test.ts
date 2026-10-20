/*
  Ordem de laboratório verde (t232, teste 4): depois de "Excluir pedido" o cartão some na hora, mesmo que o router.refresh()
  demore; o aviso de sucesso só aparece se a ação deu certo.
  Roda: node --test src/lib/pedidos/pedidos-excluir-some.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cliente = readFileSync("src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx", "utf8");

test("pedido excluído sai da lista local sem esperar o refresh", () => {
  assert.match(cliente, /const \[excluidos, setExcluidos\] = useState<string\[\]>\(\[\]\)/);
  assert.match(cliente, /pedidos\.filter\(\(p\) => !excluidos\.includes\(p\.id\)\)/);
  assert.match(cliente, /visiveis\.map\(\(p\) =>/);
  assert.doesNotMatch(cliente, /\{pedidos\.map\(/);
});

test("aviso 'Pedido excluído' só depois de a ação dar certo", () => {
  const trecho = cliente.slice(cliente.indexOf('data-testid="pedido-excluir-confirmar"'));
  const ordem = [trecho.indexOf("excluirPedido(p.id)"), trecho.indexOf("if (!ok) return"), trecho.indexOf("setExcluidos("), trecho.indexOf("setAviso(")];
  assert.ok(ordem.every((i) => i > 0), "trechos presentes");
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, "ação → checa ok → remove → avisa");
});
