/*
  Auditoria de erros e estados vazios — achado nº 8: "Meus pedidos" (morador) e "Pedidos na sua cidade" (dono) mostravam
  que não havia pedido quando a leitura do banco falhava — o morador podia publicar um pedido repetido e o dono perdia
  pedidos compatíveis. Agora as duas telas pedem com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta
  tela" com "Tentar de novo".
  Roda: node --test src/lib/data/lista-pedidos-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("os pedidos lançam na falha do banco quando a tela pede com exigir", () => {
  const src = ler("src/lib/data/pedidos-actions.ts");
  assert.match(src, /export async function getMeusPedidos\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_PEDIDOS_NAO_CARREGARAM\);\n\s*const pedidos = data \?\? \[\];/);
  assert.match(src, /export async function getPedidosParaProprietario\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /if \(\(erroMural \|\| erroResps\) && opcoes\.exigir\) throw new Error\(MSG_PEDIDOS_NAO_CARREGARAM\);/);
  assert.match(src, /await listMyProperties\(\{ exigir: opcoes\.exigir \}\)/);
});

test("as duas telas pedem com exigir", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos/page.tsx"), /getMeusPedidos\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos-cidade/page.tsx"), /await getPedidosParaProprietario\(\{ exigir: true \}\)/);
});
