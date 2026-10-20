import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 8302024d: as marcas só valem se estiverem ligadas nos pontos certos.
const src = (p: string) => readFileSync(p, "utf8");

test("o cartão de imóvel mostra a marca do usuário", () => {
  assert.match(src("src/components/property-card.tsx"), /<MarcaImovel propertyId=\{property\.id\}/);
});

test("contato (dúvida, visita, candidatura) grava 'contatou' no servidor, depois de checar login", () => {
  const a = src("src/lib/data/actions.ts");
  const i = a.indexOf('gravarMarca(supabase, user.id, propertyId, "contatado_em")');
  assert.ok(i > a.indexOf("export async function requestLead"), "gravarMarca dentro de requestLead");
  assert.ok(i > a.indexOf("Não autenticado", a.indexOf("export async function requestLead")) || i > a.indexOf("needsAuth: true"));
});

test("a página do imóvel marca 'Visto' e pré-preenche a data da última busca", () => {
  const d = src("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(d, /marcarVisto\(property\.id\)/);
  assert.match(d, /ultimaBuscaParaPedido\(/);
});

test("ações validam id e exigem login; marcas nunca vão para anúncio de exemplo", () => {
  const a = src("src/lib/marcas/actions.ts");
  assert.match(a, /idValido\(imovelId\)/);
  assert.match(a, /isExemplo\(imovelId\)/);
  assert.match(a, /auth\.getUser\(\)/);
  assert.match(a, /\.eq\("user_id", user\.id\)/);
});

test("pedido novo lê a última busca (nº de pessoas) e o último motivo, e guarda o motivo ao publicar", () => {
  const d = src("src/app/(public)/pedidos/novo/page.tsx");
  assert.match(d, /ultimaBuscaParaPedido\(/);
  assert.match(d, /ultimoMotivoParaPedido\(/);
  assert.match(d, /setItem\(CHAVE_ULTIMO_MOTIVO, motivo\)/);
  assert.match(src("src/app/(public)/buscar/search-client.tsx"), /pessoas: adults \+ children/);
});
