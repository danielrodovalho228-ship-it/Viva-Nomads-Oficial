/*
  Links do app: lista de rotas (app × site × auth), links recebidos pelo app,
  retorno seguro depois do login e arquivos .well-known.
  Roda: node --test src/config/rotas-app.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { aasa, assetlinks, caminhoDoLink, IMPRESSAO_PLAY_APP_SIGNING, impressoesAndroid, caminhoInterno, destinoDaRota, intentFiltersExpo, ROTAS_APP } from "./rotas-app.ts";
import { safeInternalPath } from "../lib/safe-redirect.ts";
import { GET as getApple } from "../app/api/well-known/apple/route.ts";
import { GET as getAndroid } from "../app/api/well-known/android/route.ts";
import nextConfig from "../../next.config.ts";

const { getPathMatch } = createRequire(import.meta.url)("next/dist/shared/lib/router/utils/path-match");

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

test("telas do proprietário que antes caíam no aviso agora ficam no app", () => {
  for (const p of ["/dashboard/ferramentas", "/dashboard/simulador", "/dashboard/roi-imovel", "/dashboard/assinatura", "/dashboard/fechamento", "/dashboard/fechamento/abc"]) {
    assert.equal(destinoDaRota(p), "app", p);
  }
  assert.equal(destinoDaRota("/dashboard/simuladorx"), "site");
});

test("Equipe (admin) abre dentro do app; o acesso é decidido no servidor (404 a não-admin)", () => {
  for (const p of ["/admin", "/admin/agentes", "/admin/documentos", "/admin/atendimento/1"]) assert.equal(destinoDaRota(p), "app", p);
  assert.equal(destinoDaRota("/adminx"), "site");
  assert.match(readFileSync(new URL("../app/(dashboard)/admin/layout.tsx", import.meta.url), "utf8"), /role !== "admin"\) notFound\(\)/);
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /isAdminRoute && user[\s\S]*role !== "admin"[\s\S]*status: 404/);
});

test("telas só do site", () => {
  for (const p of [
    "/dashboard/viabilidade",
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
});

test("assetlinks.json no formato do Google", () => {
  const f = "AB:".repeat(31) + "AB";
  assert.deepEqual(assetlinks("br.com.vivanomads.app", [f]), [
    { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "br.com.vivanomads.app", sha256_cert_fingerprints: [f] } },
  ]);
});

test("assetlinks: a chave de upload (variável) continua e a do Play App Signing entra como segunda, na mesma relação", () => {
  const upload = "AB:".repeat(31) + "AB";
  assert.equal(IMPRESSAO_PLAY_APP_SIGNING, "9C:54:64:53:98:96:35:68:86:59:04:4A:7D:6E:FC:AD:8A:A1:DD:7A:54:56:65:04:5D:07:0F:AE:56:40:FB:3C");
  const lista = impressoesAndroid(` ${upload.toLowerCase()} , lixo`);
  assert.deepEqual(lista, [upload, IMPRESSAO_PLAY_APP_SIGNING]);
  const json = assetlinks("br.com.vivanomads.app", lista) as { relation: string[]; target: { sha256_cert_fingerprints: string[] } }[];
  assert.equal(json.length, 1, "uma relação só (delegate_permission/common.handle_all_urls)");
  assert.deepEqual(json[0].target.sha256_cert_fingerprints, [upload, IMPRESSAO_PLAY_APP_SIGNING]);
  // Sem repetir, e a do Play sai mesmo sem a variável.
  assert.deepEqual(impressoesAndroid(`${IMPRESSAO_PLAY_APP_SIGNING},${upload}`), [IMPRESSAO_PLAY_APP_SIGNING, upload]);
  assert.deepEqual(impressoesAndroid(undefined), [IMPRESSAO_PLAY_APP_SIGNING]);
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
  for (const fora of ["/auth/confirm"]) {
    assert.ok(!links.data.some((d) => d.path === fora || (d.pathPrefix && fora.startsWith(d.pathPrefix))), fora);
  }
  assert.deepEqual(esquema.data, [{ scheme: "vivanomads" }]);
});

test(".well-known: JSON com content-type certo; Apple 404 sem configuração; Android sempre com a do Play", async () => {
  delete process.env.APP_IOS_IDS;
  delete process.env.APP_ANDROID_SHA256;
  assert.equal(getApple().status, 404);
  const soPlay = getAndroid();
  assert.equal(soPlay.status, 200);
  assert.deepEqual(((await soPlay.json()) as { target: { sha256_cert_fingerprints: string[] } }[])[0].target.sha256_cert_fingerprints, [IMPRESSAO_PLAY_APP_SIGNING]);
  process.env.APP_IOS_IDS = "ABCDE12345.br.com.vivanomads.app";
  process.env.APP_ANDROID_SHA256 = "ab:".repeat(31) + "ab";
  const apple = getApple();
  const android = getAndroid();
  assert.equal(apple.status, 200);
  assert.match(apple.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(((await apple.json()) as { applinks: { details: { appIDs: string[] }[] } }).applinks.details[0].appIDs[0], "ABCDE12345.br.com.vivanomads.app");
  assert.equal(android.status, 200);
  assert.match(android.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(((await android.json()) as { target: { sha256_cert_fingerprints: string[] } }[])[0].target.sha256_cert_fingerprints, ["AB:".repeat(31) + "AB", IMPRESSAO_PLAY_APP_SIGNING]);
  process.env.APP_IOS_IDS = "nao-e-um-id";
  assert.equal(getApple().status, 404);
});

test(".well-known: servido por rewrite (sem redirecionamento)", async () => {
  const rewrites = (await nextConfig.rewrites!()) as { source: string; destination: string }[];
  assert.ok(rewrites.some((r) => r.source === "/.well-known/apple-app-site-association" && r.destination === "/api/well-known/apple"));
  assert.ok(rewrites.some((r) => r.source === "/.well-known/assetlinks.json" && r.destination === "/api/well-known/android"));
  // Nenhum redirect casa com /.well-known/* (o www → ápice tem a exceção; ver www-well-known.test.ts).
  const redirects = await nextConfig.redirects!();
  for (const caminho of ["/.well-known/assetlinks.json", "/.well-known/apple-app-site-association"]) {
    const casa = redirects.filter((r) => getPathMatch(r.source, { strict: true, removeUnnamedParams: true, regexModifier: (x: string) => x })(caminho));
    assert.deepEqual(casa.map((r) => r.source), [], `redirect pega ${caminho}`);
  }
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.ok(!proxy.includes(".well-known"), "o proxy não intercepta .well-known");
});

test("fallback do 'Abrir no navegador': só caminho do próprio domínio, nunca outro endereço", () => {
  assert.equal(caminhoInterno("https://vivanomads.com.br/dashboard/ferramentas?x=1"), "/dashboard/ferramentas?x=1");
  assert.equal(caminhoInterno("https://www.vivanomads.com.br/admin"), "/admin");
  assert.equal(caminhoInterno("https://evil.example/dashboard"), "/dashboard");
  assert.equal(caminhoInterno("lixo"), "/dashboard");
});

test("nenhum link do menu/painel do proprietário cai no aviso 'Esta parte fica no site'", () => {
  const arquivos = [
    "src/components/account/conta-menu.tsx",
    "src/components/layout/dashboard-shell.tsx",
    "src/app/(dashboard)/dashboard/ferramentas/page.tsx",
    "src/components/plan-gate.tsx",
  ];
  const aceitos = new Set(["/dashboard/ferramentas", "/dashboard/simulador", "/dashboard/roi-imovel", "/dashboard/assinatura", "/dashboard/fechamento"]);
  for (const f of arquivos) {
    let src: string;
    try {
      src = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/href=["'{`]+\s*["'`]?(\/dashboard\/[a-z-]+)/g)) {
      if (aceitos.has(m[1])) assert.equal(destinoDaRota(m[1]), "app", `${f}: ${m[1]}`);
    }
  }
});
