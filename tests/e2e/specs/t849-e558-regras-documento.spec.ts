import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T849 — E558: o campo do documento do imóvel declara as regras ANTES do envio — um arquivo por imóvel (arquivo já usado
  em outro cadastro é recusado), tamanho mínimo de 10 KB, tipos aceitos e conferência manual em até 48 h. Visível, acima
  do botão de envio, sem rolagem lateral. 1280 e 390.
*/
for (const largura of [1280, 390] as const) {
  test.describe(`T849 — E558 (${largura}px)`, () => {
    test.skip(!hasAccount("proprietario"), "sem conta de proprietário de teste");
    test.use({ storageState: authFile("proprietario"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("as 4 regras aparecem junto do campo, antes do botão de envio", async ({ page }) => {
      await page.goto("/dashboard/imoveis/novo?etapa=revisao", { waitUntil: "networkidle" });
      const secao = page.getByTestId("antes-secao-documento");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      if ((await secao.getAttribute("data-aberta")) !== "1") await page.getByTestId("antes-secao-documento-abrir").click();

      const regras = page.locator('[data-testid="documento-regras"]:visible').first();
      await expect(regras).toBeVisible();
      await expect(regras).toContainText("Um arquivo por imóvel: arquivo já usado em outro cadastro é recusado.");
      await expect(regras).toContainText("Tamanho mínimo de 10 KB.");
      await expect(regras).toContainText("JPG ou PNG");
      await expect(regras).toContainText("PDF");
      await expect(regras).toContainText("conferência manual em até 48 horas");

      const enviar = page.locator('[data-testid="documento-enviar"]:visible').first();
      const [r, b] = [await regras.boundingBox(), await enviar.boundingBox()];
      expect(r && b && r.y + r.height <= b.y, "regras acima do botão de envio").toBe(true);
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await regras.screenshot({ path: `tests/laboratorio/saida/t849-regras-${largura}.png` });
    });
  });
}
