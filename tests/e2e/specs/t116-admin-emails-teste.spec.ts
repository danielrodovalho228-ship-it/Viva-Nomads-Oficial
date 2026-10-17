import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T116 — Admin: /admin/emails-teste mostra os e-mails guardados das contas de teste, com o
 * destinatário mascarado, sem rolagem lateral (ordem 7436a29a item 4).
 */
test.describe("T116 — Admin: caixa de e-mails de teste", () => {
  test.use({ storageState: authFile("admin") });
  const assunto = `Lab caixa de teste ${Date.now()}`;

  test.beforeAll(async () => {
    if (!NO_LABORATORIO) return;
    const { error } = await adm().from("emails_teste").insert({ evento: "lab", assunto, corpo: "Seu código é 123456.", destinatario_mascarado: "l•••@lab.vivanomads.test" });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (NO_LABORATORIO) await adm().from("emails_teste").delete().eq("assunto", assunto);
  });

  for (const largura of [390, 1280]) {
    test(`lista o e-mail guardado a ${largura}px`, async ({ page }) => {
      test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin/emails-teste", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("emails-teste")).toBeVisible({ timeout: 20_000 });
      const lista = page.getByTestId(largura < 768 ? "emails-teste-cartoes" : "emails-teste-tabela");
      await expect(lista).toContainText(assunto);
      await expect(lista).toContainText("l•••@lab.vivanomads.test");
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);
    });
  }
});
