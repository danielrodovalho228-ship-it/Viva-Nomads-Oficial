import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T138 — ordem 8f0582d6 (D6 e D8), painéis a 390 px:
 *  - o botão "Fale com a Viva" não cobre o último card (o conteúdo reserva espaço embaixo);
 *  - estado vazio sem ilustração mostra o ícone em círculo de destaque (padrão de Mensagens).
 */
test.describe("T138 — painéis 390 px", () => {
  test.use({ storageState: authFile("inquilino"), viewport: { width: 390, height: 844 } });

  for (const rota of ["/dashboard/ferramentas", "/dashboard/favoritos", "/dashboard/candidaturas"]) {
    test(`${rota}: o botão da Viva não cobre o fim do conteúdo`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const viva = page.getByTestId("fale-com-a-viva");
      await expect(viva).toBeVisible({ timeout: 20_000 });
      // A página pode crescer depois do primeiro scroll (cartões que chegam por fetch): rola de novo
      // e mede até o fim do conteúdo ficar estável, em vez de medir uma única vez.
      const medir = async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(300);
        const botao = await viva.boundingBox();
        const ultimo = await page.locator("main").first().evaluate((m) => {
          const filhos = [...m.querySelectorAll<HTMLElement>("*")].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0);
          return Math.max(...filhos.map((e) => e.getBoundingClientRect().bottom));
        });
        return ultimo - (botao!.y + 1);
      };
      await expect.poll(medir, { message: `${rota}: conteúdo termina acima do botão`, timeout: 15_000 }).toBeLessThanOrEqual(0);
    });
  }

  test("estados vazios usam o ícone em círculo de destaque", async ({ page }) => {
    for (const rota of ["/dashboard/buscas", "/dashboard/candidaturas", "/dashboard/comparar"]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const vazio = page.getByTestId("estado-vazio").first();
      if (!(await vazio.isVisible().catch(() => false))) continue; // conta com dados: nada a provar aqui
      const icone = vazio.getByTestId("estado-vazio-icone");
      if ((await icone.count()) === 0) continue; // usa ilustração própria
      const c = await icone.boundingBox();
      expect(c!.width, `${rota}: círculo`).toBeGreaterThanOrEqual(80);
      expect(Math.abs(c!.width - c!.height)).toBeLessThanOrEqual(1);
    }
  });
});
