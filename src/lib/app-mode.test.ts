/*
  Modo app: detecção por user-agent e rotas de marketing.
  Roda: node --test src/lib/app-mode.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { isAppUserAgent, isMarketingPath, appHome } from "./app-mode.ts";

test("reconhece o user-agent do app (Expo e Capacitor marcado)", () => {
  assert.equal(isAppUserAgent("Mozilla/5.0 (iPhone) VivaNomadsApp/1.0 (expo)"), true);
  assert.equal(isAppUserAgent("Mozilla/5.0 (Linux; Android 14; wv) VivaNomadsApp/1.0 (capacitor)"), true);
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
