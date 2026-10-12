import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  codigoTotpValido,
  decidirPortaoMfa,
  mensagemErroMfa,
  mfaAdminObrigatoria,
  tentativasRestantes,
  urlAtivar2fa,
  urlVerificarCodigo,
} from "./mfa.ts";
import { ehAdmin, sessaoAal2 } from "../data/admin-guard.ts";

test("portão: aal2 libera; fator com sessão aal1 pede código; sem fator obriga a ativar", () => {
  assert.equal(decidirPortaoMfa("aal2", "aal2"), "liberar");
  assert.equal(decidirPortaoMfa("aal1", "aal2"), "verificar");
  assert.equal(decidirPortaoMfa("aal1", "aal1"), "ativar");
  assert.equal(decidirPortaoMfa(undefined, undefined), "ativar");
  assert.equal(decidirPortaoMfa(null, "aal1"), "ativar");
});

test("destino volta COMPLETO (pathname+search) e recusa open redirect", () => {
  assert.equal(urlVerificarCodigo("/admin/financeiro?mes=10"), "/auth/verificar-codigo?redirect=%2Fadmin%2Ffinanceiro%3Fmes%3D10");
  assert.equal(urlVerificarCodigo("https://evil.com"), "/auth/verificar-codigo?redirect=%2Fadmin");
  assert.equal(urlAtivar2fa("//evil.com"), "/dashboard/conta/seguranca?obrigatorio=admin&redirect=%2Fadmin");
});

test("código TOTP: 6 dígitos, com ou sem espaço; letras e tamanhos errados são recusados", () => {
  assert.equal(codigoTotpValido("123 456"), "123456");
  assert.equal(codigoTotpValido("12345"), null);
  assert.equal(codigoTotpValido("1234567"), null);
  assert.equal(codigoTotpValido("12a456"), null);
  assert.equal(codigoTotpValido(""), null);
});

test("limite de tentativas e mensagens sem detalhe interno", () => {
  assert.equal(tentativasRestantes(0), 5);
  assert.equal(tentativasRestantes(5), 0);
  assert.equal(tentativasRestantes(99), 0);
  assert.match(mensagemErroMfa("Invalid TOTP code entered"), /incorreto ou vencido/);
  assert.match(mensagemErroMfa("over_request_rate_limit"), /Muitas tentativas/);
  assert.doesNotMatch(mensagemErroMfa("secret=ABC"), /ABC/);
});

test("válvula de emergência só desliga com 'off'", () => {
  assert.equal(mfaAdminObrigatoria(undefined), true);
  assert.equal(mfaAdminObrigatoria("on"), true);
  assert.equal(mfaAdminObrigatoria("off"), false);
});

function fakeSupabase(role: string | null, aal: { currentLevel: string; nextLevel: string } | "erro") {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? { role } : null }) }) }) }),
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => (aal === "erro" ? { data: null, error: { message: "x" } } : { data: aal, error: null }),
      },
    },
  } as never;
}

test("ehAdmin: admin aal2 passa; admin aal1 (só senha) NÃO; não-admin não passa; erro fecha", async () => {
  assert.equal(await ehAdmin(fakeSupabase("admin", { currentLevel: "aal2", nextLevel: "aal2" }), "u"), true);
  assert.equal(await ehAdmin(fakeSupabase("admin", { currentLevel: "aal1", nextLevel: "aal2" }), "u"), false);
  assert.equal(await ehAdmin(fakeSupabase("admin", { currentLevel: "aal1", nextLevel: "aal1" }), "u"), false);
  assert.equal(await ehAdmin(fakeSupabase("admin", "erro"), "u"), false);
  assert.equal(await ehAdmin(fakeSupabase("owner", { currentLevel: "aal2", nextLevel: "aal2" }), "u"), false);
  assert.equal(await sessaoAal2(fakeSupabase(null, { currentLevel: "aal1", nextLevel: "aal1" })), false);
});

test("proxy e layout do admin aplicam o portão AAL2; server actions do admin usam o helper", () => {
  const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /getAuthenticatorAssuranceLevel/);
  assert.match(proxy, /decidirPortaoMfa/);
  const layout = readFileSync(new URL("../../app/(dashboard)/admin/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /decidirPortaoMfa/);
  for (const f of ["../socios/caixa-actions.ts", "../parceiros/admin-actions.ts", "../fotografos/actions.ts", "../data/pedidos-actions.ts"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /sessaoAal2/, f);
  }
});
