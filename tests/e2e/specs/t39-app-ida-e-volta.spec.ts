import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T39 — IDA E VOLTA DO APP (ordem bc09134e, item 5). Roda no projeto `app-mobile`
 * (390x844, user-agent "VivaNomadsApp"). Cobre as telas Ferramentas/Planos dentro do app.
 * E237: a ponte app → navegador (/api/app/ponte, do app Capacitor) saiu; o app Expo entra por /api/app/login-social.
 */
test.describe("T39 — App: ida e volta", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "app-mobile", "só no projeto app-mobile");
  });

  test.describe("anônimo", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

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

    test("Ferramentas abre no app e o voltar do sistema retorna ao painel, com a sessão", async ({ page }) => {
      test.skip(!hasAccount("proprietario"), "sem conta de teste do proprietário");
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Esta parte fica no site")).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard\/?$/);
    });
  });
});
