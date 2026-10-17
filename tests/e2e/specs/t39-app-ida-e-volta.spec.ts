import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T39 — IDA E VOLTA DO APP (ordem bc09134e, item 5). Roda no projeto `app-mobile`
 * (390x844, user-agent "VivaNomadsApp"). Cobre a ponte app → navegador (sem login novo,
 * uso único, destino só interno) e as telas Ferramentas/Planos dentro do app.
 */
test.describe("T39 — App: ida e volta", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "app-mobile", "só no projeto app-mobile");
  });

  test.describe("anônimo", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("emitir ponte sem login = 401", async ({ request }) => {
      const res = await request.post("/api/app/ponte", { data: { destino: "/dashboard/assinatura" } });
      expect(res.status()).toBe(401);
    });

    test("trocar token inventado recusa e cai em /auth, sem sessão", async ({ page }) => {
      await page.goto(
        "/api/app/ponte/entrar?t=falso&u=00000000-0000-4000-8000-000000000000&d=/dashboard/assinatura",
      );
      await expect(page).toHaveURL(/\/auth/);
    });

    test("destino externo na troca é recusado", async ({ page }) => {
      await page.goto(
        "/api/app/ponte/entrar?t=falso&u=00000000-0000-4000-8000-000000000000&d=https://exemplo.com",
      );
      await expect(page).toHaveURL(/\/auth/);
      expect(new URL(page.url()).hostname).not.toBe("exemplo.com");
    });

    test("Ferramentas pede login dentro do app e Assinatura (aposentada) volta à tela inicial do app", async ({ page }) => {
      await page.goto("/dashboard/ferramentas");
      await expect(page).toHaveURL(/\/auth/);
      await expect(page.getByText("Esta parte fica no site")).toHaveCount(0);
      // Ordem 90181c57: não há mais assinatura; /dashboard/assinatura vai para /precos, que no app
      // (página de marketing) leva às boas-vindas de quem não entrou.
      await page.goto("/dashboard/assinatura");
      await expect(page).toHaveURL(/\/app\/boas-vindas/);
      await expect(page.getByText("Esta parte fica no site")).toHaveCount(0);
    });
  });

  test.describe("proprietário", () => {
    test.use({ storageState: hasAccount("proprietario") ? authFile("proprietario") : { cookies: [], origins: [] } });

    test("Ferramentas abre no app e o voltar do sistema retorna ao painel, com a sessão", async ({ page, request }) => {
      test.skip(!hasAccount("proprietario"), "sem conta de teste do proprietário");
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Esta parte fica no site")).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard\/?$/);
      // Sessão continua: a ponte só é emitida a quem está logado.
      const res = await request.post("/api/app/ponte", { data: { destino: "/dashboard/assinatura" } });
      expect(res.status()).toBe(200);
      expect(typeof (await res.json()).token).toBe("string");
    });

    test("ponte rejeita destino externo e destino fora da lista", async ({ request }) => {
      test.skip(!hasAccount("proprietario"), "sem conta de teste do proprietário");
      for (const destino of ["https://exemplo.com", "//exemplo.com", "/api/admin/agentes"]) {
        const res = await request.post("/api/app/ponte", { data: { destino } });
        expect(res.status()).toBe(400);
      }
    });
  });
});
