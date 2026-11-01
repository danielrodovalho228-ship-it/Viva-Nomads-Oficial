/*
  Auditoria de erros e estados vazios — achado nº 10: "Serviços" (quem contrata) e os pedidos do parceiro mostravam
  "nenhum pedido" quando a leitura do banco falhava — o parceiro perdia um pedido novo, o cliente achava que o pedido
  sumiu. Agora as duas listas são pedidas com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta
  tela" com "Tentar de novo".
  Roda: node --test src/lib/parceiros/pedidos-servico-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("pedidos de serviço lançam na falha do banco quando a tela pede com exigir", () => {
  const src = ler("src/lib/parceiros/pedido-actions.ts");
  for (const fn of ["meusPedidosDeServico", "pedidosDoMeuParceiro"]) assert.match(src, new RegExp(`export async function ${fn}\\(opcoes: \\{ exigir\\?: boolean \\} = \\{\\}\\)`), fn);
  assert.equal([...src.matchAll(/\) throw new Error\(MSG_PEDIDOS_SERVICO_NAO_CARREGARAM\);/g)].length, 3);
});

test("as telas pedem com exigir", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/servicos/page.tsx"), /meusPedidosDeServico\(\{ exigir: true \}\)/);
  assert.match(ler("src/components/parceiros/pedidos-do-parceiro.tsx"), /await pedidosDoMeuParceiro\(\{ exigir: true \}\)/);
});
