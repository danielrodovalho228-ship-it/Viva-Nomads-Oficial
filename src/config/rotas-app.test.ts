/*
  Links do app: lista de rotas (app × site × auth), links recebidos pelo app,
  retorno seguro depois do login e arquivos .well-known.
  Roda: node --test src/config/rotas-app.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aasa, assetlinks, caminhoDoLink, destinoDaRota, intentFiltersExpo, ROTAS_APP } from "./rotas-app.ts";
import { safeInternalPath } from "../lib/safe-redirect.ts";
import { GET as getApple } from "../app/api/well-known/apple/route.ts";
import { GET as getAndroid } from "../app/api/well-known/android/route.ts";
import nextConfig from "../../next.config.ts";

test("telas do app", () => {
  for (const p of [
    "/auth",
    "/buscar",
    "/buscar?cidade=uberlandia",
    "/imoveis/123",
    "/pedidos/novo",
    "/ajuda",
    "/ajuda?chamado=VN-000100",
    "/dashboard",
    "/dashboard/",
    "/dashboard/mensagens",
    "/dashboard/mensagens/abc",
    "/dashboard/contratos",
    "/dashboard/candidaturas",
    "/dashboard/leads",
    "/dashboard/pedidos",
    "/dashboard/pedidos-cidade?pedido=1",
    "/dashboard/solicitacoes",
    "/dashboard/imoveis",
    "/dashboard/imoveis/novo",
    "/dashboard/imoveis/123/editar",
    "/qualificar",
    "/dashboard/verificacao",
    "/dashboard/conta",
    "/dashboard/conta/ajuda",
    "/dashboard/favoritos",
    "/excluir-conta",
  ]) {
    assert.equal(destinoDaRota(p), "app", p);
  }
});

test("telas só do site", () => {
  for (const p of [
    "/admin",
    "/admin/atendimento/1",
    "/admin/financeiro",
    "/dashboard/fechamento",
    "/dashboard/assinatura",
    "/dashboard/simulador",
    "/dashboard/roi-imovel",
    "/dashboard/viabilidade",
    "/dashboard/ferramentas",
    "/simulacao",
    "/precos",
    "/",
    "/dashboardx",
    "/ajudaextra",
  ]) {
    assert.equal(destinoDaRota(p), "site", p);
  }
});

test("autenticação fica sempre no navegador", () => {
  for (const p of ["/auth/confirm?token_hash=x&type=signup", "/auth/callback?code=1", "/auth/reset", "/excluir-conta/confirmar?token=x", "/api/atendimento/avaliar?c=1"]) {
    assert.equal(destinoDaRota(p), "auth", p);
  }
});

test("link recebido pelo app → caminho interno (e nada de fora)", () => {
  assert.equal(caminhoDoLink("https://vivanomads.com.br/dashboard/contratos?id=1#topo"), "/dashboard/contratos?id=1#topo");
  assert.equal(caminhoDoLink("https://www.vivanomads.com.br/ajuda?chamado=VN-000100"), "/ajuda?chamado=VN-000100");
  assert.equal(caminhoDoLink("vivanomads://perfil"), "/dashboard/conta");
  assert.equal(caminhoDoLink("vivanomads://mensagens"), "/dashboard/mensagens");
  assert.equal(caminhoDoLink("vivanomads:///dashboard/pedidos?x=1"), "/dashboard/pedidos?x=1");
  for (const ruim of ["https://evil.com/dashboard", "https://vivanomads.com.br.evil.com/x", "http://vivanomads.com.br/x", "javascript:alert(1)", "data:text/html,oi", "nada", ""]) {
    assert.equal(caminhoDoLink(ruim), null, ruim);
  }
});

test("retorno depois do login (?redirect=/next=) só aceita caminho interno", () => {
  assert.equal(safeInternalPath("/dashboard/contratos/123"), "/dashboard/contratos/123");
  assert.equal(safeInternalPath("/ajuda?chamado=VN-000100"), "/ajuda?chamado=VN-000100");
  for (const ruim of ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "javascript:alert(1)", "evil.com"]) {
    assert.equal(safeInternalPath(ruim), "/dashboard", ruim);
  }
});

test("apple-app-site-association: JSON válido, auth excluída antes, telas do app incluídas", () => {
  const a = aasa(["ABCDE12345.br.com.vivanomads.app"]) as { applinks: { details: { appIDs: string[]; components: { "/": string; exclude?: boolean }[] }[] } };
  const comps = a.applinks.details[0].components;
  JSON.parse(JSON.stringify(a));
  const primeiraInclusao = comps.findIndex((c) => !c.exclude);
  assert.ok(comps.slice(0, primeiraInclusao).every((c) => c.exclude), "exclusões vêm primeiro");
  assert.ok(comps.some((c) => c["/"] === "/auth/confirm/*" && c.exclude));
  for (const r of ROTAS_APP) assert.ok(comps.some((c) => c["/"] === r.caminho && !c.exclude), r.caminho);
  assert.ok(!comps.some((c) => !c.exclude && c["/"].startsWith("/admin")));
});

test("assetlinks.json no formato do Google", () => {
  const f = "AB:".repeat(31) + "AB";
  assert.deepEqual(assetlinks("br.com.vivanomads.app", [f]), [
    { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "br.com.vivanomads.app", sha256_cert_fingerprints: [f] } },
  ]);
});

test("Expo (app.json): intentFilters com autoVerify, https, host e só as telas do app", () => {
  const [links, esquema] = intentFiltersExpo() as { action: string; autoVerify?: boolean; data: Record<string, string>[]; category: string[] }[];
  assert.equal(links.autoVerify, true);
  assert.deepEqual(links.category, ["BROWSABLE", "DEFAULT"]);
  assert.ok(links.data.every((d) => d.scheme === "https" && d.host === "vivanomads.com.br"));
  for (const d of links.data) {
    const caminho = d.path ?? d.pathPrefix;
    assert.equal(destinoDaRota(d.pathPrefix ? `${caminho}x` : caminho), "app", caminho);
  }
  for (const fora of ["/admin", "/dashboard/assinatura", "/dashboard/fechamento", "/dashboard/simulador", "/auth/confirm"]) {
    assert.ok(!links.data.some((d) => d.path === fora || (d.pathPrefix && fora.startsWith(d.pathPrefix))), fora);
  }
  assert.deepEqual(esquema.data, [{ scheme: "vivanomads" }]);
});

test(".well-known: JSON com content-type certo; 404 sem configuração", async () => {
  delete process.env.APP_IOS_IDS;
  delete process.env.APP_ANDROID_SHA256;
  assert.equal(getApple().status, 404);
  assert.equal(getAndroid().status, 404);
  process.env.APP_IOS_IDS = "ABCDE12345.br.com.vivanomads.app";
  process.env.APP_ANDROID_SHA256 = "ab:".repeat(31) + "ab";
  const apple = getApple();
  const android = getAndroid();
  assert.equal(apple.status, 200);
  assert.match(apple.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(((await apple.json()) as { applinks: { details: { appIDs: string[] }[] } }).applinks.details[0].appIDs[0], "ABCDE12345.br.com.vivanomads.app");
  assert.equal(android.status, 200);
  assert.match(android.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(((await android.json()) as { target: { sha256_cert_fingerprints: string[] } }[])[0].target.sha256_cert_fingerprints[0], "AB:".repeat(31) + "AB");
  process.env.APP_IOS_IDS = "nao-e-um-id";
  assert.equal(getApple().status, 404);
});

test(".well-known: servido por rewrite (sem redirecionamento)", async () => {
  const rewrites = (await nextConfig.rewrites!()) as { source: string; destination: string }[];
  assert.ok(rewrites.some((r) => r.source === "/.well-known/apple-app-site-association" && r.destination === "/api/well-known/apple"));
  assert.ok(rewrites.some((r) => r.source === "/.well-known/assetlinks.json" && r.destination === "/api/well-known/android"));
  const redirects = await nextConfig.redirects!();
  assert.ok(!redirects.some((r) => r.source.includes(".well-known")));
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.ok(!proxy.includes(".well-known"), "o proxy não intercepta .well-known");
});
