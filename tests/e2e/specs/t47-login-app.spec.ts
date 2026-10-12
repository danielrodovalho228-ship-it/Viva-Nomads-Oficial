import { test, expect } from "@playwright/test";

/**
 * T47 — LOGIN NO APP (laboratório e preview, ordem 225d0648). Login social (Google/Apple) no app:
 *  1. POST /api/app/login-social emite um `state` assinado (5 min, uso único) só para provedor válido;
 *  2. GET /auth/app-callback com state válido devolve ao app por vivanomads://auth/callback (303, sem cache e sem referrer);
 *  3. o MESMO state não vale duas vezes; state forjado, sem code ou provedor inválido caem em /auth, sem detalhes.
 * Google simulado: nada é enviado ao Google — o teste é o "meio" do caminho, que o servidor controla.
 */
test.describe("T47 — Login social no app (rotas do servidor)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const CODE = "codigo-pkce-de-teste-123456";

  async function novoState(request: import("@playwright/test").APIRequestContext, provedor = "google"): Promise<string> {
    const r = await request.post("/api/app/login-social", { data: { provedor } });
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toContain("no-store");
    const { state } = (await r.json()) as { state: string };
    expect(state).toMatch(/^[0-9a-f]{24}\.\d+\.[0-9a-f]{40}$/);
    return state;
  }

  test("provedor inválido = 400; Google e Apple recebem um state", async ({ request }) => {
    const ruim = await request.post("/api/app/login-social", { data: { provedor: "facebook" } });
    expect(ruim.status()).toBe(400);
    const semCorpo = await request.post("/api/app/login-social", { data: {} });
    expect(semCorpo.status()).toBe(400);
    await novoState(request, "google");
    await novoState(request, "apple");
  });

  test("callback com state válido volta ao app por vivanomads://auth/callback, e só uma vez", async ({ request }) => {
    const state = await novoState(request);
    const url = `/auth/app-callback?provedor=google&code=${CODE}&state=${encodeURIComponent(state)}`;
    const ok = await request.get(url, { maxRedirects: 0 });
    expect(ok.status()).toBe(303);
    const destino = ok.headers()["location"] ?? "";
    expect(destino.startsWith("vivanomads://auth/callback")).toBe(true);
    expect(destino).toContain(`code=${CODE}`);
    expect(ok.headers()["cache-control"]).toContain("no-store");
    expect(ok.headers()["referrer-policy"]).toBe("no-referrer");

    const segunda = await request.get(url, { maxRedirects: 0 });
    expect(segunda.status()).toBe(303);
    expect(new URL(segunda.headers()["location"]).pathname).toBe("/auth");
  });

  test("state do Google não vale para a Apple; forjado, sem code e code com lixo caem em /auth", async ({ request }) => {
    const state = await novoState(request, "google");
    const casos = [
      `/auth/app-callback?provedor=apple&code=${CODE}&state=${encodeURIComponent(state)}`,
      `/auth/app-callback?provedor=google&code=${CODE}&state=${"a".repeat(24)}.9999999999.${"b".repeat(40)}`,
      `/auth/app-callback?provedor=google&state=${encodeURIComponent(state)}`,
      `/auth/app-callback?provedor=google&code=${encodeURIComponent("<script>alert(1)</script>")}&state=${encodeURIComponent(state)}`,
      `/auth/app-callback?provedor=orkut&code=${CODE}&state=${encodeURIComponent(state)}`,
    ];
    for (const caso of casos) {
      const r = await request.get(caso, { maxRedirects: 0 });
      expect(r.status(), caso).toBe(303);
      const loc = r.headers()["location"] ?? "";
      expect(new URL(loc).pathname, caso).toBe("/auth");
      expect(loc).not.toContain("vivanomads://");
    }
  });
});
