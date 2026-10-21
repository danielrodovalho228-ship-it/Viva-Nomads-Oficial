/*
  Barra inferior por papel (Prompt 41, item 2): morador, proprietário e parceiro aprovado com 5 abas cada; admin sem
  barra (fica fora do app). Cada aba aponta para uma rota que já existe.
  Roda: node --test src/lib/nav-mobile.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import {
  ABAS_POR_PAPEL,
  ROTULO_GANHOS_DONO,
  abasDoPapel,
  ehAbaRaizApp,
  papelDaBarra,
  tituloDaTelaApp,
  voltaParaAdmin,
  type PapelBarra,
} from "./nav-mobile.ts";

const ROTULOS: Record<PapelBarra, string[]> = {
  morador: ["Início", "Buscar", "Mensagens", "Estadias", "Perfil"],
  proprietario: ["Início", "Anúncios", "Mensagens", "Ganhos", "Perfil"],
  parceiro: ["Início", "Pedidos", "Agenda", "Ganhos", "Perfil"],
};

test("barra por papel: 5 itens, na ordem do Prompt 41", () => {
  for (const papel of Object.keys(ROTULOS) as PapelBarra[]) {
    const abas = ABAS_POR_PAPEL[papel];
    assert.equal(abas.length, 5, papel);
    assert.deepEqual(abas.map((a) => a.label), ROTULOS[papel], papel);
    assert.ok(!abas.some((a) => a.href.startsWith("/admin")), papel);
  }
});

test("cada aba aponta para uma rota que JÁ existe (nenhuma tela nova)", () => {
  const raiz = new URL("../app/", import.meta.url);
  const pagina = (rota: string) =>
    rota === "/buscar"
      ? existsSync(new URL("(public)/buscar/page.tsx", raiz))
      : existsSync(new URL(`(dashboard)${rota}/page.tsx`, raiz));
  for (const abas of Object.values(ABAS_POR_PAPEL)) for (const a of abas) assert.ok(pagina(a.href.split("#")[0]), a.href);
  // As âncoras do parceiro existem no painel /dashboard/parceiro.
  const pedidos = readFileSync(new URL("../components/parceiros/pedidos-do-parceiro.tsx", import.meta.url), "utf8");
  const painel = readFileSync(new URL("../app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx", import.meta.url), "utf8");
  assert.match(pedidos, /<Panel id="pedidos"/);
  assert.match(pedidos, /<Panel id="ganhos"/);
  assert.match(painel, /<Panel id="agenda"/);
});

test("Ganhos do proprietário leva o rótulo 'pago direto na sua conta'", () => {
  const ganhos = ABAS_POR_PAPEL.proprietario.find((a) => a.label === "Ganhos");
  assert.equal(ROTULO_GANHOS_DONO, "pago direto na sua conta");
  assert.equal(ganhos?.descricao, "Ganhos: pago direto na sua conta");
  assert.equal(ganhos?.href, "/dashboard/contratos");
});

test("papel da barra: admin sem barra; parceiro só aprovado; senão o modo", () => {
  assert.equal(papelDaBarra({ admin: true, modo: "owner", parceiroAprovado: true, preferenciaParceiro: true }), null);
  assert.deepEqual(abasDoPapel(null), []);
  assert.equal(papelDaBarra({ admin: false, modo: "tenant", parceiroAprovado: false }), "morador");
  assert.equal(papelDaBarra({ admin: false, modo: "owner", parceiroAprovado: false }), "proprietario");
  // Pedido de parceria em análise (não aprovado): nunca a barra do parceiro, nem com a preferência ligada.
  assert.equal(papelDaBarra({ admin: false, modo: "tenant", parceiroAprovado: false, preferenciaParceiro: true, pathname: "/dashboard/parceiro" }), "morador");
  assert.equal(papelDaBarra({ admin: false, modo: "owner", parceiroAprovado: true, preferenciaParceiro: true }), "parceiro");
  assert.equal(papelDaBarra({ admin: false, modo: "owner", parceiroAprovado: true, pathname: "/dashboard/parceiro" }), "parceiro");
  assert.equal(papelDaBarra({ admin: false, modo: "owner", parceiroAprovado: true, pathname: "/dashboard/imoveis" }), "proprietario");
});

test("títulos e aba raiz da Equipe no cabeçalho do app", () => {
  assert.equal(tituloDaTelaApp("/admin/agentes"), "Equipe");
  assert.equal(tituloDaTelaApp("/admin/documentos"), "Documentos");
  assert.equal(tituloDaTelaApp("/admin/atendimento/3"), "Atendimento");
  assert.equal(tituloDaTelaApp("/admin"), "Admin");
  assert.equal(ehAbaRaizApp("/admin"), true);
  assert.equal(ehAbaRaizApp("/admin/agentes"), false);
  assert.equal(ehAbaRaizApp("/dashboard/locacoes"), true);
  assert.equal(ehAbaRaizApp("/dashboard/parceiro"), true);
});

test("Voltar nas telas /admin/* leva ao painel /admin; o painel e o resto não", () => {
  assert.equal(voltaParaAdmin("/admin/socios"), true);
  assert.equal(voltaParaAdmin("/admin/agentes"), true);
  assert.equal(voltaParaAdmin("/admin"), false);
  assert.equal(voltaParaAdmin("/dashboard/conta"), false);
  const f = readFileSync(new URL("../components/app/app-header.tsx", import.meta.url), "utf8");
  assert.match(f, /voltaParaAdmin\(pathname\) \? router\.push\("\/admin"\)/);
});

test("Voltar do app tem alvo de toque de 44 px e a spec t14 repete o toque até hidratar", () => {
  const f = readFileSync(new URL("../components/app/app-header.tsx", import.meta.url), "utf8");
  assert.match(f, /aria-label="Voltar"[\s\S]*h-11 w-11/);
  assert.doesNotMatch(f, /h-10 w-10/);
  const spec = readFileSync(new URL("../../tests/e2e/specs/t14-app-mode.spec.ts", import.meta.url), "utf8");
  assert.match(spec, /getByRole\("button", \{ name: "Voltar" \}\)\.click\(\);\s*await expect\(page\)\.toHaveURL\(\/\\\/admin\\\/\?\$\/, \{ timeout: 5_000 \}\)/);
});

test("painel /admin lista todos os itens do menu do admin como atalhos", () => {
  // Menu em cascata (ordem 9f3085d8): o grupo Administração mora em config/menu-painel.ts.
  const config = readFileSync(new URL("../config/menu-painel.ts", import.meta.url), "utf8");
  const atalhos = readFileSync(new URL("../app/(dashboard)/admin/atalhos-admin.tsx", import.meta.url), "utf8");
  const menu = [...config.matchAll(/href: "(\/admin[^"]*)"/g)].map((m) => m[1]);
  assert.ok(menu.length >= 10);
  for (const h of menu.filter((x) => x !== "/admin")) assert.ok(atalhos.includes(`href="${h}"`) || atalhos.includes(`href: "${h}"`), h);
  assert.match(atalhos, /min-h-11/);
});

test("a barra decide o papel pela regra única (admin sem barra) e flutua com a sombra única", () => {
  const f = readFileSync(new URL("../components/layout/mobile-tab-bar.tsx", import.meta.url), "utf8");
  assert.match(f, /papelDaBarra\(\{ admin: user\?\.role === "admin"/);
  assert.match(f, /if \(!papel \|\| tabs\.length === 0\) return null;/);
  assert.match(f, /shadow-flutuante/);
  assert.match(f, /grid grid-cols-5/);
});

test("Central no app: botão Ativar notificações e atalhos visíveis só no app", () => {
  const f = readFileSync(new URL("../app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8");
  assert.match(f, /data-testid="atalhos-app"/);
  assert.match(f, /<AtivarNotificacoes/);
  assert.match(f, /href="\/admin\/documentos"/);
  assert.match(f, /href="\/admin\/atendimento"/);
});
