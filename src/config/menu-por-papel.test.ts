/*
  Prompt 42, item 3 — a lista do menu por papel (config/menu-por-papel.ts) e a montagem (config/menu-painel.ts).
  Roda: node --test src/config/menu-por-papel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { MENU_POR_PAPEL, temPapel, type ContextoMenu, type ItemDoPapel, type PapelMenu } from "./menu-por-papel.ts";
import { folhas, menuDoPainel } from "./menu-painel.ts";

const base: ContextoMenu = { temImovel: false, admin: false, estadiaAtiva: false };
const tudo: ContextoMenu = { temImovel: true, admin: true, estadiaAtiva: true, parceiro: true, imoveisAtivos: 5 };

function folhasDaLista(itens: ItemDoPapel[]): ItemDoPapel[] {
  return itens.flatMap((i) => (i.filhos ? folhasDaLista(i.filhos) : i.href ? [i] : []));
}
const dosPapeis = (papel: PapelMenu) => MENU_POR_PAPEL.filter((s) => s.papel === papel).flatMap((s) => s.itens);
const hrefs = (papel: PapelMenu) => folhasDaLista(dosPapeis(papel)).map((i) => i.href!);

test("a lista tem as quatro seções de papel e as comuns, na ordem do menu", () => {
  assert.deepEqual(
    MENU_POR_PAPEL.map((s) => s.papel),
    ["todos", "admin", "morador", "todos", "proprietario", "parceiro", "todos"],
  );
  assert.deepEqual(dosPapeis("morador").map((i) => i.id), ["moradia"]);
  assert.deepEqual(dosPapeis("proprietario").map((i) => i.id), ["imoveis", "contratos"]);
  assert.deepEqual(dosPapeis("parceiro").map((i) => i.id), ["parceiro"]);
  assert.deepEqual(dosPapeis("admin").map((i) => i.id), ["admin"]);
});

test("quem tem cada papel: todos são moradores; dono = já anunciou; parceiro e admin pelo contexto", () => {
  assert.equal(temPapel("morador", base), true);
  assert.equal(temPapel("proprietario", base), false);
  assert.equal(temPapel("proprietario", { ...base, temImovel: true }), true);
  assert.equal(temPapel("parceiro", base), false);
  assert.equal(temPapel("parceiro", { ...base, parceiro: true }), true);
  assert.equal(temPapel("admin", base), false);
  assert.equal(temPapel("admin", { ...base, admin: true }), true);
});

test("itens de admin só para admin: nenhuma rota /admin fora da seção admin, e o menu sem admin não tem nenhuma", () => {
  for (const papel of ["todos", "morador", "proprietario", "parceiro"] as const) {
    for (const h of hrefs(papel)) assert.doesNotMatch(h, /^\/admin/, `${papel}: ${h}`);
  }
  for (const h of hrefs("admin")) assert.match(h, /^\/admin(\/|$)/, h);
  const semAdmin = folhas(menuDoPainel({ ...tudo, admin: false })).map((i) => i.href!);
  assert.ok(!semAdmin.some((h) => h.startsWith("/admin")));
  const comAdmin = folhas(menuDoPainel(tudo)).map((i) => i.href!);
  for (const h of hrefs("admin")) assert.ok(comAdmin.includes(h), h);
});

test("todo href da lista é rota que existe no painel (ou a busca/pedido públicos) e ids são únicos", () => {
  const todas = MENU_POR_PAPEL.flatMap((s) => folhasDaLista(s.itens));
  const ids = todas.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "ids únicos");
  for (const { href } of todas) {
    const rota = href!.split("#")[0];
    if (rota === "/buscar") {
      assert.ok(existsSync(new URL("../app/(public)/buscar/page.tsx", import.meta.url)), rota);
      continue;
    }
    if (rota === "/pedidos/novo") {
      assert.ok(existsSync(new URL("../app/(public)/pedidos/novo/page.tsx", import.meta.url)), rota);
      continue;
    }
    assert.match(rota, /^\/(dashboard|admin|qualificar)(\/|$)/, rota);
    assert.ok(existsSync(new URL(`../app/(dashboard)${rota}/page.tsx`, import.meta.url)), `tela existe: ${rota}`);
  }
});

test("condições: Locações, Solicitações/Serviços, Agenda, Orçamentos e Análise da carteira", () => {
  const ids = (ctx: ContextoMenu) => folhas(menuDoPainel(ctx)).map((i) => i.id);
  assert.ok(ids(base).includes("estadias"));
  assert.ok(!ids({ ...base, temImovel: true }).includes("estadias"), "dono sem estadia não vê Locações");
  assert.ok(ids({ ...base, temImovel: true, estadiaAtiva: true }).includes("estadias"));
  assert.ok(!ids(base).includes("solicitacoes") && !ids(base).includes("servicos"));
  assert.ok(ids({ ...base, estadiaAtiva: true }).includes("solicitacoes"));
  assert.ok(!ids(base).includes("agenda") && ids({ ...base, temImovel: true }).includes("agenda"));
  assert.ok(!ids(base).includes("orcamentos") && ids({ ...base, temImovel: true }).includes("orcamentos"));
  assert.ok(!ids({ ...base, temImovel: true, imoveisAtivos: 2 }).includes("carteira"));
  assert.ok(ids({ ...base, temImovel: true, imoveisAtivos: 3 }).includes("carteira"));
});

test("item 4: o simulador PF × PJ está em Ferramentas, para todos", () => {
  const ferramentas = menuDoPainel(base).find((i) => i.id === "ferramentas")!;
  const trib = folhas([ferramentas]).find((i) => i.id === "tributacao");
  assert.equal(trib?.href, "/dashboard/tributacao");
  assert.match(trib!.rotulo, /PF × PJ/);
});

test("a montagem não leva a condição para o componente (só id, rótulo, ícone, href, filhos)", () => {
  const chaves = new Set(folhas(menuDoPainel(tudo)).flatMap((i) => Object.keys(i)));
  assert.deepEqual([...chaves].sort(), ["href", "icone", "id", "rotulo"]);
});

test("a casca desenha o menu da montagem e não define itens por conta própria", () => {
  const shell = readFileSync(new URL("../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /menuDoPainel\(\{/);
  assert.doesNotMatch(shell, /rotulo: "/, "nenhum item de menu escrito na casca");
});
