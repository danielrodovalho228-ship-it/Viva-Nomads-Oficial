/*
  E472 (AD) — Admin → Pedidos de moradia: na MESMA área, "Pedidos no ar: 1 real" × lista Real "0 pedidos nesta lista" ×
  "Pedidos do período 2" × "Nenhum pedido no sistema". Causa: os números saíam do cliente de serviço (todas as linhas)
  e a LISTA saía do cliente da sessão, pela RLS `is_admin()` — que exige AAL2 de quem tem 2FA verificado. Numa sessão
  sem AAL2 a lista voltava vazia (só os pedidos da própria conta), e a frase "Nenhum pedido no sistema" ainda afirmava
  que o sistema inteiro estava vazio a partir da lista já filtrada.
  Correção: uma fonte só — a lista lê pelo MESMO cliente de serviço dos números (o admin já conferido por
  adminDaPagina), e a lista vazia diz "Nenhum pedido nesta lista" (nunca "no sistema").
  Roda: node --test src/lib/admin/e472-pedidos-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a lista lê pelo mesmo cliente de serviço dos números (nada da RLS da sessão)", () => {
  const ind = ler("src/lib/data/admin-indicadores.ts");
  const f = ind.slice(ind.indexOf("export async function pedidosMoradiaAdmin"), ind.indexOf("export async function pedidosMoradiaAdmin") + 700);
  assert.match(f, /export async function pedidosMoradiaAdmin\(admin: Admin\)/);
  assert.match(f, /admin\.from\("pedidos_moradia"\)\.select\("\*"\)/);
  assert.match(f, /if \(error\) throw new Error\(/);
  const pg = ler("src/app/(dashboard)/admin/pedidos/page.tsx");
  assert.ok(pg.includes("admin ? pedidosMoradiaAdmin(admin) : Promise.resolve([] as Record<string, unknown>[])"));
  assert.doesNotMatch(pg, /adminListPedidos/);
  assert.doesNotMatch(ler("src/lib/data/pedidos-admin.ts"), /export async function adminListPedidos/);
});

test("a lista vazia não afirma nada sobre o sistema inteiro", () => {
  const cli = ler("src/app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx");
  assert.doesNotMatch(cli, /Nenhum pedido no sistema/);
  assert.match(cli, /Nenhum pedido nesta lista\./);
});
