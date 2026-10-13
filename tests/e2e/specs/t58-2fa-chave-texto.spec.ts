import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T58 — ativação do 2FA no celular (ordens 33c943b4 item 3/4 e 1d1967f4):
 * chave em texto agrupada de 4 em 4, "Copiar código" e link otpauth:// ANTES do QR,
 * sem nada sobrepondo campos ou botões a 360/390 px.
 */
for (const largura of [360, 390]) {
  test.describe(`T58 — 2FA chave em texto (${largura}px)`, () => {
    test.use({ storageState: authFile("proprietario"), viewport: { width: largura, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });

    test("mostra a chave, copia e oferece o link do app antes do QR", async ({ page }) => {
      await page.goto("/dashboard/conta/seguranca");
      await page.getByRole("button", { name: /Ativar verificação em duas etapas/ }).click();

      const chave = page.getByTestId("chave-2fa");
      await expect(chave).toBeVisible();
      const texto = (await chave.textContent())?.trim() ?? "";
      expect(texto).toMatch(/^([A-Z2-7]{4} )*[A-Z2-7]{1,4}$/);

      const link = page.getByRole("link", { name: "Abrir no app autenticador" });
      await expect(link).toHaveAttribute("href", /^otpauth:\/\/totp\/.*secret=[A-Z2-7]+/);
      const qr = page.getByAltText("QR code para o app autenticador");
      expect((await link.boundingBox())!.y).toBeLessThan((await qr.boundingBox())!.y);

      await page.getByRole("button", { name: "Copiar código" }).click();
      await expect(page.getByRole("button", { name: "Copiado!" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(texto.replace(/\s/g, ""));

      // Nenhum botão/campo da tela é coberto por outro elemento (elementFromPoint no centro).
      const alvos = page.locator("main button, main input, main a[href]");
      const n = await alvos.count();
      for (let i = 0; i < n; i++) {
        const el = alvos.nth(i);
        if (!(await el.isVisible())) continue;
        await el.scrollIntoViewIfNeeded();
        const livre = await el.evaluate((e) => {
          const r = e.getBoundingClientRect();
          const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!topo && (e === topo || e.contains(topo));
        });
        expect(livre, `alvo ${i} coberto`).toBe(true);
      }
    });
  });
}
