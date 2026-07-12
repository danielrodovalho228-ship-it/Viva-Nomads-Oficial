import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T-DOC — CONFERÊNCIA DE DOCUMENTOS (fila de moderação do admin) @criticos
 *
 * O admin abre /admin/documentos, vê o documento inline, marca o checklist de
 * conferência e só então aprova; recusar exige motivo estruturado. Os testes
 * exercem os PORTÕES (checklist habilita Aprovar; motivo habilita Recusar) sem
 * COMMITAR a decisão — para não mutar dados compartilhados do banco de teste.
 *
 * Resiliente à fila vazia: sem itens, valida o estado vazio.
 */
test.describe("T-DOC — Conferência de documentos @criticos", () => {
  test.use({ storageState: authFile("admin") });

  async function irParaFila(page: Page) {
    await page.goto("/admin/documentos", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Documentos em confer/i })).toBeVisible();
  }

  test("a fila abre dentro da casca admin", async ({ page }) => {
    await irParaFila(page);
    await expect(page.locator("aside nav")).toBeVisible(); // dentro do layout
    // Nunca deve overclaimar propriedade — só conferência do documento.
    await expect(page.locator("body")).not.toContainText(/propriedade verificada|im[óo]vel verificado/i);
  });

  test("checklist habilita o Aprovar; motivo habilita a Recusa", async ({ page }) => {
    await irParaFila(page);
    const primeiroCard = page.locator("section, [class*='rounded']").filter({
      has: page.getByRole("button", { name: /Aprovar/i }),
    }).first();

    if (!(await primeiroCard.isVisible().catch(() => false))) {
      // Fila vazia é um estado válido — valida o vazio e encerra.
      await expect(page.getByText(/Nada na fila/i)).toBeVisible();
      test.skip(true, "Fila vazia no banco de teste — sem item para exercer os portões.");
      return;
    }

    const aprovar = primeiroCard.getByRole("button", { name: /Aprovar/i });
    // Sem checklist marcado, Aprovar fica desabilitado.
    await expect(aprovar).toBeDisabled();

    // Marca todos os itens do checklist → Aprovar habilita.
    const checks = primeiroCard.locator('input[type="checkbox"]');
    const n = await checks.count();
    for (let i = 0; i < n; i++) await checks.nth(i).check();
    await expect(aprovar).toBeEnabled();

    // Desmarcar um item volta a travar (portão real, não cosmético).
    await checks.first().uncheck();
    await expect(aprovar).toBeDisabled();

    // Fluxo de recusa: motivo estruturado obrigatório.
    await primeiroCard.getByRole("button", { name: /Recusar/i }).click();
    const confirmar = primeiroCard.getByRole("button", { name: /Confirmar recusa/i });
    await expect(confirmar).toBeDisabled(); // sem motivo escolhido
    await primeiroCard.getByRole("combobox").selectOption("ilegivel");
    await expect(confirmar).toBeEnabled();
    // "Outro" sem detalhe volta a travar.
    await primeiroCard.getByRole("combobox").selectOption("outro");
    await expect(confirmar).toBeDisabled();
  });
});
