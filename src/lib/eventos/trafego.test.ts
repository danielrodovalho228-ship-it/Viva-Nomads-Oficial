/*
  E288-B — tráfego de teste fora das métricas. Roda: node --test src/lib/eventos/trafego.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cookieDoCabecalho, descartarVisitaDeTeste, ehTrafegoE2e, eventoConta, rotuloForaDaContagem, trafegoDoEvento } from "./trafego.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("marca da suíte: cabeçalho OU cookie, só com o valor exato", () => {
  assert.equal(ehTrafegoE2e("e2e", null), true);
  assert.equal(ehTrafegoE2e(" E2E ", null), true);
  assert.equal(ehTrafegoE2e(null, "e2e"), true);
  assert.equal(ehTrafegoE2e(null, null), false);
  assert.equal(ehTrafegoE2e("real", "x"), false);
  assert.equal(ehTrafegoE2e("", ""), false);
});

test("origem do evento: e2e vence; depois conta is_teste; senão real", () => {
  assert.equal(trafegoDoEvento({ e2e: true, contaTeste: true }), "e2e");
  assert.equal(trafegoDoEvento({ e2e: true, contaTeste: false }), "e2e");
  assert.equal(trafegoDoEvento({ e2e: false, contaTeste: true }), "teste");
  assert.equal(trafegoDoEvento({ e2e: false, contaTeste: false }), "real");
});

test("contagem: só 'real' de conta que não é de teste; linha antiga (sem trafego) segue a regra da 0181", () => {
  const teste = new Set(["t1"]);
  assert.equal(eventoConta({ trafego: "real", usuario_id: null }, teste), true);
  assert.equal(eventoConta({ trafego: "real", usuario_id: "u1" }, teste), true);
  assert.equal(eventoConta({ trafego: "e2e", usuario_id: null }, teste), false);
  assert.equal(eventoConta({ trafego: "teste", usuario_id: "t1" }, teste), false);
  assert.equal(eventoConta({ trafego: "real", usuario_id: "t1" }, teste), false);
  assert.equal(eventoConta({ usuario_id: null }, teste), true);
  assert.equal(eventoConta({ usuario_id: "t1" }, teste), false);
});

test("cookie cru e Vercel Analytics: descarta a página com vn_trafego=e2e ou navegador automatizado", () => {
  assert.equal(cookieDoCabecalho("a=1; vn_trafego=e2e; b=2", "vn_trafego"), "e2e");
  assert.equal(cookieDoCabecalho("vn_trafegox=e2e", "vn_trafego"), null);
  assert.equal(descartarVisitaDeTeste("a=1; vn_trafego=e2e", false), true);
  assert.equal(descartarVisitaDeTeste("a=1", true), true);
  assert.equal(descartarVisitaDeTeste("a=1; vn_origem=x", false), false);
});

test("linha discreta: 'N eventos de teste fora da contagem' (some quando é zero)", () => {
  assert.equal(rotuloForaDaContagem(0), null);
  assert.equal(rotuloForaDaContagem(1), "1 evento de teste fora da contagem");
  assert.equal(rotuloForaDaContagem(6480), "6.480 eventos de teste fora da contagem");
});

test("ligações: a suíte manda a marca; a rota grava trafego; o proxy devolve o cookie; as leituras contam só o real", () => {
  const cfg = ler("playwright.config.ts");
  assert.match(cfg, /const TRAFEGO_HEADERS = \{ "x-vn-origem": "e2e" \};/);
  assert.match(cfg, /extraHTTPHeaders: \{ \.\.\.TRAFEGO_HEADERS, \.\.\.\(BYPASS_HEADERS \?\? \{\}\) \}/);
  assert.match(ler("tests/e2e/global-setup.ts"), /"x-vn-origem": "e2e"/);
  assert.match(ler("tests/e2e/fixtures/camera.ts"), /"x-vn-origem": "e2e"/);
  const rota = ler("src/app/api/evento/route.ts");
  assert.match(rota, /trafegoDoEvento\(\{ e2e: ehTrafegoE2e\(request\.headers\.get\(CABECALHO_TRAFEGO\), cookie\(request, COOKIE_TRAFEGO\)\), contaTeste \}\)/);
  assert.match(rota, /select\("is_teste"\)/);
  assert.match(ler("src/proxy.ts"), /resposta\.cookies\.set\(COOKIE_TRAFEGO, VALOR_E2E/);
  assert.match(ler("src/lib/data/admin-indicadores.ts"), /linhas\.filter\(\(e\) => eventoConta\(e, teste\)\)/);
  assert.match(ler("src/lib/data/funil.ts"), /linhasEv\.filter\(\(e\) => eventoConta\(e, teste\)\)/);
  // O Funil lê os eventos página a página (o banco corta em 1.000 linhas).
  assert.doesNotMatch(ler("src/lib/data/funil.ts"), /from\("eventos"\)[^\n]*\.limit\(50000\)/);
});
