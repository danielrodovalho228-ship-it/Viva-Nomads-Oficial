/*
  Abas do app: admin ganha "Equipe" (Central dos agentes); os demais papéis não.
  Roda: node --test src/lib/nav-mobile.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abasDoApp, ehAbaRaizApp, tituloDaTelaApp } from "./nav-mobile.ts";

test("admin vê a aba Equipe (6 abas) em qualquer mundo", () => {
  for (const mundo of ["owner", "tenant"] as const) {
    const abas = abasDoApp(mundo, true);
    assert.equal(abas.length, 6);
    assert.deepEqual(abas.at(-1)?.href, "/admin/agentes");
    assert.equal(abas.at(-1)?.label, "Equipe");
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
  assert.equal(ehAbaRaizApp("/admin/agentes"), true);
});

test("a barra só recebe a aba Equipe quando o papel é admin", () => {
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
