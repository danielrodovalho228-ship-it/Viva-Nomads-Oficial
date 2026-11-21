import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T1680 — Ordem 12a8086d, item 4 (parte 2): a API /api/admin passa pelo proxy só para o limite de 30 min parado.
  O caso que encerra a sessão (cookie de atividade velho + sessão de admin) NÃO roda aqui de propósito: o signOut
  derrubaria a sessão gravada que o resto da suíte de admin usa. Ele é provado no unitário
  src/lib/admin/api-admin-ociosa.test.ts. Aqui ficam as garantias de que nada mais mudou:
  1) visitante com cookie de atividade velho: o proxy não inventa 401 (sem sessão não há o que expirar) — a rota
     segue recusando como antes (403/404);
  2) admin com sessão nova lendo (GET) a API: responde normalmente e a leitura NÃO renova o relógio.
*/
const VELHO = String(Date.now() - 2 * 60 * 60 * 1000);

test.describe("T1680 — API do admin com o limite de 30 min parado", () => {
  test("visitante com cookie de atividade velho continua só recusado (sem 401 de sessão)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "vn_admin_ativo", value: VELHO, url: baseURL ?? "http://localhost:3000" }]);
    for (const rota of ["/api/admin/aprovacoes", "/api/admin/agentes/memoria"]) {
      const r = await ctx.request.get(rota, { failOnStatusCode: false, maxRedirects: 0 });
      expect([403, 404], `${rota} → ${r.status()}`).toContain(r.status());
    }
    await ctx.close();
  });

  test("admin lendo a API: responde e a leitura não renova o relógio", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const r = await ctx.request.get("/api/admin/aprovacoes", { failOnStatusCode: false, maxRedirects: 0 });
    expect(r.status(), "admin não pode cair em 401 com sessão nova").not.toBe(401);
    const setCookie = r.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).join("\n");
    expect(setCookie).not.toContain("vn_admin_ativo=");
    await ctx.close();
  });
});
