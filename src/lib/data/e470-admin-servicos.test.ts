/*
  E470 — Admin "Serviços do morador" caía na tela de erro ("Não conseguimos abrir esta tela do admin") e "Tentar de
  novo" repetia o erro. Causa: a leitura embutia `profiles:tenant_id(full_name)`, mas servicos_pedidos.tenant_id
  aponta para auth.users (FK servicos_pedidos_tenant_id_fkey), não para profiles — o PostgREST não acha a relação
  (PGRST200) e devolve erro mesmo com a tabela vazia; o erro sobe (Achado 33) e a tela inteira cai.
  Correção: lê os pedidos sem o embed e busca os nomes em profiles à parte, só dos moradores da lista.
  Roda: node --test src/lib/data/e470-admin-servicos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./servicos-morador-actions.ts", import.meta.url), "utf8");
const corpo = src.slice(src.indexOf("export async function pedidosServicoAdmin"), src.indexOf("export async function atualizarEstadoPedidoServico"));
const migracao = readFileSync(new URL("../../../supabase/migrations/0174_servicos_pedidos.sql", import.meta.url), "utf8");

test("a FK de tenant_id aponta para auth.users, não para profiles (por isso o embed não existe)", () => {
  assert.match(migracao, /tenant_id uuid not null references auth\.users/i);
});

test("a leitura do admin não embute profiles pela tenant_id", () => {
  assert.doesNotMatch(corpo, /profiles:tenant_id/);
  assert.doesNotMatch(corpo, /profiles!/);
  assert.match(corpo, /tenant_id/);
});

test("os nomes vêm de profiles à parte, só dos moradores dos pedidos, só o nome", () => {
  assert.match(corpo, /const ids = \[\.\.\.new Set\(/);
  assert.match(corpo, /admin\.from\("profiles"\)\.select\("id, full_name"\)\.in\("id", ids\)/);
  assert.doesNotMatch(corpo, /select\([^)]*(email|phone)/);
});

test("erro na leitura dos pedidos segue subindo (Achado 33), sem lista vazia falsa", () => {
  assert.match(corpo, /if \(error\) throw new Error/);
});

test("nome que falta cai em 'Morador', nunca derruba a tela", () => {
  assert.match(corpo, /\?\? "Morador"/);
});
