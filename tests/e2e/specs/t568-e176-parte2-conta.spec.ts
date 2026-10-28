import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T568 — E176-IMPL parte 2 (mesma especificação aprovada): "Notificações" é uma página só (a do sino, na casca da
  Conta: preferências do perfil-06 em cima e os avisos embaixo; /dashboard/conta/notificacoes redireciona);
  "Segurança e verificações" é item próprio da Conta; as filhas da Conta têm "← <seção>" no topo, em toda largura.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T568 — E176 parte 2: Conta", () => {
  test.use({ storageState: authFile("inquilino") });

  for (const w of [1280, 390] as const) {
    test(`${w} px — Notificações numa página só; Segurança e verificações com item próprio; '← Privacidade' em Sair da Viva`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/conta/notificacoes", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/dashboard\/notificacoes$/, { timeout: 30_000 });
      await expect(page.locator("h1:visible")).toHaveText("Notificações");
      await expect(page.getByTestId("notif-salvar")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("notificacoes-avisos")).toBeVisible();
      if (w === 1280) await expect(page.getByTestId("conta-menu-notificacoes")).toHaveAttribute("aria-current", "page");
      await page.screenshot({ path: `${SAIDA}/t568-notificacoes-${w}.png`, fullPage: true });

      await page.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1:visible")).toHaveText("Segurança e verificações", { timeout: 30_000 });
      if (w === 1280) {
        await expect(page.getByTestId("conta-menu-seguranca")).toHaveAttribute("aria-current", "page");
        await expect(page.getByTestId("conta-menu-privacidade")).not.toHaveAttribute("aria-current", "page");
      }
      await page.screenshot({ path: `${SAIDA}/t568-seguranca-${w}.png` });

      await page.goto("/dashboard/conta/excluir", { waitUntil: "domcontentloaded" });
      const voltar = page.getByTestId("voltar-lista");
      await expect(voltar).toBeVisible({ timeout: 30_000 });
      await expect(voltar).toHaveText("← Privacidade");
      await page.screenshot({ path: `${SAIDA}/t568-excluir-${w}.png` });
      await voltar.click();
      await expect(page).toHaveURL(/\/dashboard\/conta\/privacidade$/);
    });
  }

  test("390 px — o menu da Conta lista Segurança e verificações; Seu perfil público tem '← Perfil'", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
    await expect(page.getByTestId("conta-menu").getByRole("link", { name: /Segurança e verificações/ })).toHaveAttribute("href", "/dashboard/conta/seguranca");
    await expect(page.getByTestId("conta-menu").getByRole("link", { name: /Notificações/ })).toHaveAttribute("href", "/dashboard/notificacoes");
    await page.screenshot({ path: `${SAIDA}/t568-menu-conta-390.png`, fullPage: true });
    await page.goto("/dashboard/conta/perfil-publico", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("voltar-lista")).toHaveText("← Perfil", { timeout: 30_000 });
    await expect(page.getByTestId("voltar-lista")).toHaveAttribute("href", "/dashboard/conta/perfil");
  });
});
