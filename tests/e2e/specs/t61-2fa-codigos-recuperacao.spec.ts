import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { gerarCodigoTotp } from "../fixtures/totp";

/**
 * T61 — códigos de recuperação do 2FA (ordens 58901f0f e 10484c4c):
 * ao ativar saem 10 códigos (uma vez); "Gerar novos códigos" invalida os antigos;
 * na tela do código, um código de recuperação vale UMA vez, desliga o app antigo e manda cadastrar de novo;
 * código errado mostra erro claro. A conta é a de proprietário do laboratório (nunca a do Daniel).
 */
test.describe.configure({ mode: "serial" });

test.describe("T61 — 2FA códigos de recuperação (390px)", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 800 } });

  test("ativar entrega 10 códigos; novos invalidam os antigos; código vale uma vez", async ({ page, browser }) => {
    test.setTimeout(120000);
    await page.goto("/dashboard/conta/seguranca");
    await page.getByRole("button", { name: /Ativar duas etapas/ }).click();
    const segredo = ((await page.getByTestId("chave-2fa").textContent()) ?? "").replace(/\s/g, "");
    await page.locator("#codigo-ativar").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: "Confirmar código e ativar" }).click();

    const lista = page.getByTestId("codigos-recuperacao").locator("li");
    await expect(lista).toHaveCount(10);
    const primeiros = await lista.allTextContents();
    for (const c of primeiros) expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "Já guardei" }).click();
    await expect(page.getByTestId("codigos-restantes")).toContainText("Restam 10");

    // Gerar novos: lista diferente e os antigos deixam de valer.
    await page.getByRole("button", { name: "Gerar novos códigos" }).click();
    const novos = await lista.allTextContents();
    expect(novos).toHaveLength(10);
    expect(novos.filter((c) => primeiros.includes(c))).toHaveLength(0);

    // Segunda sessão (só senha, aal1): tela do código.
    const ctx = await browser.newContext({ storageState: authFile("proprietario"), viewport: { width: 390, height: 800 } });
    const p2 = await ctx.newPage();
    try {
      await p2.goto("/auth/verificar-codigo?redirect=%2Fdashboard");
      await p2.getByRole("button", { name: "Usar código de recuperação" }).click();

      // Código errado e código ANTIGO: erro claro, nada muda.
      for (const ruim of ["ZZZZZ-ZZZZZ", primeiros[0]]) {
        await p2.locator("#codigo-recuperacao").fill(ruim);
        await p2.getByRole("button", { name: "Usar código de recuperação" }).click();
        await expect(p2.getByRole("alert")).toContainText("inválido ou já usado");
      }

      // Código novo: vale uma vez, desliga o app antigo e vai para cadastrar de novo.
      await p2.locator("#codigo-recuperacao").fill(novos[0]);
      await p2.getByRole("button", { name: "Usar código de recuperação" }).click();
      await p2.waitForURL(/\/dashboard\/conta\/seguranca\?obrigatorio=admin/);
      await expect(p2.getByRole("button", { name: /Ativar duas etapas/ })).toBeVisible();

      // O mesmo código não funciona de novo (e já não há app para elevar a sessão).
      await p2.goto("/auth/verificar-codigo?redirect=%2Fdashboard");
      await expect(p2.getByRole("button", { name: /Ativar duas etapas/ })).toBeVisible({ timeout: 15000 });
    } finally {
      await ctx.close();
    }
  });

  test("mensagem de erro do código do app orienta sobre relógio e entrada nova", async ({ page }) => {
    await page.goto("/dashboard/conta/seguranca");
    const ativar = page.getByRole("button", { name: /Ativar duas etapas/ });
    test.skip(!(await ativar.isVisible({ timeout: 8000 }).catch(() => false)), "conta já com 2FA");
    await ativar.click();
    await page.locator("#codigo-ativar").fill("000000");
    await page.getByRole("button", { name: "Confirmar código e ativar" }).click();
    await expect(page.getByRole("alert")).toContainText(/relógio do celular está no automático.*entrada mais nova do app/);
  });
});
