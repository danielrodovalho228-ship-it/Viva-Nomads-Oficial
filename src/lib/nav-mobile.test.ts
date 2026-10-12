/*
  Abas do app: admin ganha "Equipe" (Central dos agentes); os demais papéis não.
  Roda: node --test src/lib/nav-mobile.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abasDoApp, ehAbaRaizApp, tituloDaTelaApp, voltaParaAdmin } from "./nav-mobile.ts";

test("admin vê a aba Admin (6 abas) em qualquer mundo", () => {
  for (const mundo of ["owner", "tenant"] as const) {
    const abas = abasDoApp(mundo, true);
    assert.equal(abas.length, 6);
    assert.deepEqual(abas.at(-1)?.href, "/admin");
    assert.equal(abas.at(-1)?.label, "Admin");
    assert.equal(abas.at(-1)?.ativoEm, "/admin");
    assert.equal(abas.at(-1)?.badge, "equipe");
  }
});

test("quem não é admin continua com 5 abas e sem link para /admin", () => {
  for (const mundo of ["owner", "tenant"] as const) {
    const abas = abasDoApp(mundo, false);
    assert.equal(abas.length, 5);
    assert.ok(!abas.some((a) => a.href.startsWith("/admin")));
  }
});

test("títulos e aba raiz da Equipe no cabeçalho do app", () => {
  assert.equal(tituloDaTelaApp("/admin/agentes"), "Equipe");
  assert.equal(tituloDaTelaApp("/admin/documentos"), "Documentos");
  assert.equal(tituloDaTelaApp("/admin/atendimento/3"), "Atendimento");
  assert.equal(tituloDaTelaApp("/admin"), "Admin");
  assert.equal(ehAbaRaizApp("/admin"), true);
  assert.equal(ehAbaRaizApp("/admin/agentes"), false);
});

test("Voltar nas telas /admin/* leva ao painel /admin; o painel e o resto não", () => {
  assert.equal(voltaParaAdmin("/admin/socios"), true);
  assert.equal(voltaParaAdmin("/admin/agentes"), true);
  assert.equal(voltaParaAdmin("/admin"), false);
  assert.equal(voltaParaAdmin("/dashboard/conta"), false);
  const f = readFileSync(new URL("../components/app/app-header.tsx", import.meta.url), "utf8");
  assert.match(f, /voltaParaAdmin\(pathname\) \? router\.push\("\/admin"\)/);
});

test("painel /admin lista todos os itens do menu do admin como atalhos", () => {
  const shell = readFileSync(new URL("../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  const atalhos = readFileSync(new URL("../app/(dashboard)/admin/atalhos-admin.tsx", import.meta.url), "utf8");
  const menu = [...shell.slice(shell.indexOf("const ADMIN_NAV")).split("];")[0].matchAll(/href: "(\/admin[^"]*)"/g)].map((m) => m[1]);
  assert.ok(menu.length >= 10);
  for (const h of menu.filter((x) => x !== "/admin")) assert.ok(atalhos.includes(`href="${h}"`) || atalhos.includes(`href: "${h}"`), h);
  assert.match(atalhos, /min-h-11/);
});

test("a barra só recebe a aba Admin quando o papel é admin", () => {
  const f = readFileSync(new URL("../components/layout/mobile-tab-bar.tsx", import.meta.url), "utf8");
  assert.match(f, /abasDoApp\(appWorld, user\?\.role === "admin"\)/);
});

test("Central no app: botão Ativar notificações e atalhos visíveis só no app", () => {
  const f = readFileSync(new URL("../app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8");
  assert.match(f, /data-testid="atalhos-app"/);
  assert.match(f, /<AtivarNotificacoes/);
  assert.match(f, /href="\/admin\/documentos"/);
  assert.match(f, /href="\/admin\/atendimento"/);
});
