import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T836 — E499: o chat "Fale com a Viva" ficava aberto ao navegar e voltar ao painel (estado preso no layout raiz).
  Agora a troca de tela fecha o chat — também ao voltar pelo histórico. 768 e 1280 (abaixo de 768 o flutuante não
  aparece, E246: em 390 confere-se só que não há chat aberto sobrando).
*/
const chat = (p: Page) => p.getByRole("dialog", { name: "Chat com a Viva" });

async function abrirChat(p: Page) {
  await p.getByTestId("fale-com-a-viva").click();
  await expect(chat(p)).toBeVisible();
}

for (const largura of [768, 1280] as const) {
  test.describe(`T836 — E499 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("site público: abrir o chat e trocar de tela fecha; voltar não reabre", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await abrirChat(page);
      await page.locator('a[href="/como-funciona"]').filter({ visible: true }).first().click();
      await page.waitForURL(/\/como-funciona$/);
      await expect(chat(page)).toHaveCount(0);
      await expect(page.getByTestId("fale-com-a-viva")).toHaveAttribute("aria-expanded", "false");
      await page.goBack();
      await page.waitForURL((u) => u.pathname === "/");
      await expect(chat(page)).toHaveCount(0);
      // continua abrindo normalmente
      await abrirChat(page);
    });

    test.describe("painel do proprietário", () => {
      test.skip(!hasAccount("proprietario"), "conta de proprietário do laboratório não configurada");
      test.use({ storageState: authFile("proprietario") });

      test("abrir o chat no painel, ir a outra tela e voltar: o chat está fechado", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "load" });
        await abrirChat(page);
        await page.locator('a[href="/dashboard/mensagens"]').filter({ visible: true }).first().click();
        await page.waitForURL(/\/dashboard\/mensagens$/);
        await expect(chat(page)).toHaveCount(0);
        await page.goBack();
        await page.waitForURL((u) => u.pathname === "/dashboard");
        await expect(chat(page)).toHaveCount(0);
        await page.screenshot({ path: `tests/laboratorio/saida/t836-painel-${largura}.png` });
      });
    });
  });
}

test.describe("T836 — E499 (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("celular: o flutuante não aparece e não há chat aberto sobrando ao navegar", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByTestId("fale-com-a-viva")).toBeHidden();
    await page.goto("/como-funciona", { waitUntil: "load" });
    await expect(chat(page)).toHaveCount(0);
  });
});
