import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab 16/10 (t3 e t56 vermelhos há 6+ execuções): os specs estavam errados, o portão está certo.
// Não-admin recebe 404 por rewrite (URL fica em /admin); visitante vai para /auth.
const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const proxy = ler("../../proxy.ts");
const t3 = ler("../../../tests/e2e/specs/t3-isolamento-papeis.spec.ts");
const t56 = ler("../../../tests/e2e/specs/t56-admin-aal2.spec.ts");

test("proxy: não-admin em /admin leva 404 (rewrite), nunca redirect para o painel", () => {
  const trecho = proxy.slice(proxy.indexOf('profile?.role !== "admin"'));
  assert.match(trecho.slice(0, 500), /NextResponse\.rewrite\(notFoundUrl, \{ status: 404 \}\)/);
});

test("proxy: visitante sem sessão em /admin vai para /auth", () => {
  assert.match(proxy, /isProtected && !user[\s\S]{0,200}pathname = "\/auth"/);
});

test("t3: espera o 404 do portão, não um redirect para /dashboard", () => {
  assert.match(t3, /toBe\(404\)/);
  assert.doesNotMatch(t3, /page\.goto\("\/admin"[\s\S]{0,120}toHaveURL\(\/\\\/dashboard/);
});

test("t56: o contexto do visitante esvazia o storageState herdado do admin", () => {
  assert.match(t56, /newContext\(\{ baseURL, storageState: \{ cookies: \[\], origins: \[\] \} \}\)/);
});
