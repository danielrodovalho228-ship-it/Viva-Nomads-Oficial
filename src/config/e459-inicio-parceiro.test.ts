/**
 * E459 (PC3, família do E443): no menu do PARCEIRO, "Início" levava a /dashboard — o início do DONO. Agora leva ao topo
 * do painel do parceiro: /dashboard/parceiro#inicio (âncora no título da página), como as outras abas do parceiro
 * (#pedidos, #agenda, #ganhos). Dono e morador continuam com Início = /dashboard. Computador e celular usam a mesma
 * fonte (abas-painel → barra de baixo). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABAS_PARCEIRO, abasDoPapelPainel, ancorasDasAbas } from "./abas-painel.ts";
import { abasDaBarra } from "../lib/nav-mobile.ts";

test("Início do parceiro = topo do painel do parceiro (nos dois menus); dono e morador seguem em /dashboard", () => {
  assert.equal(ABAS_PARCEIRO[0].rotulo, "Início");
  assert.equal(ABAS_PARCEIRO[0].href, "/dashboard/parceiro#inicio");
  assert.equal(abasDaBarra("parceiro")[0].href, "/dashboard/parceiro#inicio");
  assert.equal(abasDoPapelPainel("proprietario")[0].href, "/dashboard");
  assert.equal(abasDoPapelPainel("morador")[0].href, "/dashboard");
  assert.deepEqual(ancorasDasAbas(ABAS_PARCEIRO), { rota: "/dashboard/parceiro", ids: ["inicio", "pedidos", "agenda", "ganhos"] });
});

test("a âncora #inicio existe no topo do painel do parceiro", () => {
  const pg = readFileSync(new URL("../app/(dashboard)/dashboard/parceiro/page.tsx", import.meta.url), "utf8");
  assert.match(pg, /<div id="inicio" className="scroll-mt-24">\s*<PageTitle title="Parceiro"/);
});
