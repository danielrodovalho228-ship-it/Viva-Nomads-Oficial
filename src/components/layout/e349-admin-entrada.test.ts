/**
 * E349 — na entrada do admin pelo celular as seções ficam à vista (mesmo menu do E176, aberto), sem caçar o sanduíche.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BARRA_ADMIN } from "../../config/menu-admin.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("o shell mostra as seções só em /admin (Visão geral) e a partir da MESMA barra do admin", () => {
  const s = ler("./dashboard-shell.tsx");
  assert.match(s, /pathname === "\/admin" && <SecoesAdminEntrada itens=\{barraAdminPara\(\{ observadorQa: contadores\.observadorQa \}\)\} \/>/);
  assert.match(s, /data-testid=\{naAreaAdmin \? "admin-abrir-menu" : undefined\}/, "o botão do topo continua (E176: um menu só)");
});

test("o bloco de entrada é só celular, uma barra visível que abre com um toque e tem alvo de 44 px", () => {
  const c = ler("./secoes-admin-entrada.tsx");
  assert.match(c, /<details className=/);
  assert.match(c, /admin-secoes-resumo/);
  assert.match(c, /lg:hidden/);
  assert.match(c, /min-h-11/);
  assert.match(c, /data-testid="admin-secoes-entrada"/);
});

test("toda folha da barra do admin vira um link da entrada (nada fica só no sanduíche)", () => {
  const c = ler("./secoes-admin-entrada.tsx");
  assert.match(c, /g\.filhos!\.filter\(\(f\) => f\.href\)/);
  const folhas = BARRA_ADMIN.flatMap((i) => (i.filhos ? i.filhos : [i])).filter((i) => i.href && i.href !== "/admin");
  assert.ok(folhas.length >= 20);
});
