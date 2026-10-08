/*
  Modo app: detecção por user-agent e rotas de marketing.
  Roda: node --test src/lib/app-mode.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { isAppUserAgent, isMarketingPath, appHome } from "./app-mode.ts";

test("reconhece o user-agent do app (Expo)", () => {
  assert.equal(isAppUserAgent("Mozilla/5.0 (iPhone) VivaNomadsApp/1.0 (expo)"), true);
  assert.equal(isAppUserAgent("Mozilla/5.0 (Linux; Android 14; wv) VivaNomadsApp/1.0 (expo)"), true);
  assert.equal(isAppUserAgent("Mozilla/5.0 (Macintosh) Chrome/130"), false);
  assert.equal(isAppUserAgent(null), false);
});

test("marketing sai do app; telas do app ficam", () => {
  for (const p of ["/", "/precos", "/como-funciona", "/para-proprietarios", "/empresas", "/cidades/uberlandia", "/roi", "/socios", "/acesso-socios", "/simulacao"]) {
    assert.equal(isMarketingPath(p), true, p);
  }
  for (const p of ["/buscar", "/imoveis/abc", "/auth", "/dashboard", "/dashboard/conta", "/termos", "/privacidade", "/pedidos/novo", "/app/boas-vindas", "/excluir-conta"]) {
    assert.equal(isMarketingPath(p), false, p);
  }
  // Prefixo é por segmento: /roistas não é /roi.
  assert.equal(isMarketingPath("/roistas"), false);
});

test("aba inicial por papel (inquilino → Buscar)", () => {
  assert.equal(appHome("tenant"), "/buscar");
  assert.equal(appHome("owner"), "/dashboard");
  assert.equal(appHome(null), "/app/boas-vindas");
});

import vm from "node:vm";
import { APP_PREPAINT_SCRIPT, APP_VIEWPORT_APP } from "./app-mode.ts";

function rodaScript(ua: string, cookie = "") {
  const attrs: Record<string, string> = {};
  let meta: { content: string; getAttribute: (k: string) => string; setAttribute: (k: string, v: string) => void } | null = null;
  let observador: (() => void) | null = null;
  const novoMeta = () => {
    const m = {
      content: "width=device-width, initial-scale=1",
      getAttribute: () => m.content,
      setAttribute: (_k: string, v: string) => { m.content = v; },
    };
    return m;
  };
  const document = {
    cookie,
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    querySelector: () => meta,
    addEventListener: () => {},
  };
  class MO {
    constructor(cb: () => void) { observador = cb; }
    observe() {}
    disconnect() { observador = null; }
  }
  vm.runInNewContext(APP_PREPAINT_SCRIPT, { document, navigator: { userAgent: ua }, window: {}, MutationObserver: MO });
  return {
    attrs,
    // Simula o Next inserindo o <meta viewport> depois que o script rodou.
    inserirMeta() {
      meta = novoMeta();
      observador?.();
      return meta;
    },
  };
}

test("app: viewport sem zoom é aplicado mesmo quando o meta aparece DEPOIS do script", () => {
  const r = rodaScript("Mozilla/5.0 (iPhone) VivaNomadsApp/1.0");
  assert.equal(r.attrs["data-app"], "1");
  const m = r.inserirMeta();
  assert.equal(m.content, APP_VIEWPORT_APP);
  assert.match(m.content, /maximum-scale=1/);
});

test("fora do app: nada é marcado nem o viewport muda", () => {
  const r = rodaScript("Mozilla/5.0 (iPhone) Safari");
  assert.equal(r.attrs["data-app"], undefined);
  const m = r.inserirMeta();
  assert.equal(m.content, "width=device-width, initial-scale=1");
});

import { readFileSync } from "node:fs";

test("CSS: campos têm 16px no celular e no app (iOS não dá zoom)", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 768px\)\s*{\s*input,\s*select,\s*textarea\s*{\s*font-size: 16px !important;/);
  assert.match(css, /html\[data-app\] input,\s*html\[data-app\] select,\s*html\[data-app\] textarea\s*{\s*font-size: 16px !important;/);
});
