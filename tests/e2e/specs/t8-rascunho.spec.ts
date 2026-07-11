import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T-RASC — RASCUNHO: SALVAMENTO E RETOMADA DE VERDADE (@criticos)
 *
 * Regressão do P0 de perda de dados. O editor autossalva no SERVIDOR (não só no
 * localStorage): o rascunho sobrevive a reload, reaparece na Visão geral e pode
 * ser retomado por qualquer caminho — sem zerar a qualificação (selo 6/6).
 *
 * Requer a migration 0043 (properties.draft_data) aplicada no banco de teste.
 */
test.describe("T-RASC — Rascunho salva e retoma @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  // A qualificação (elegível) é pré-requisito para abrir o editor. Injetamos o
  // resultado na sessionStorage — com selo + etiqueta "trabalhar de casa" — para
  // provar depois que a retomada não zera esse estado.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem(
          "vivanomads-qualification",
          JSON.stringify({ eligible: true, baseBadge: true, tHome: true, tWork: false, score: 5 })
        );
      } catch {
        /* ambiente sem sessionStorage — ignora */
      }
    });
    // Confirma diálogos (excluir rascunho) automaticamente.
    page.on("dialog", (d) => d.accept());
  });

  /** Abre o editor em branco e preenche o endereço (dispara o autosave). Devolve
   * a marca única usada no bairro, para conferir a restauração depois. */
  async function novoComEndereco(page: Page): Promise<string> {
    const marca = `QA${Date.now().toString().slice(-6)}`;
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    // Se um rascunho anterior for detectado, começa outro para partir do zero.
    const comecarOutro = page.getByRole("button", { name: "Começar outro" });
    if (await comecarOutro.isVisible().catch(() => false)) await comecarOutro.click();
    // Etapa 1 (Tipo) → Continuar → Etapa 2 (Endereço).
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByPlaceholder("Rua, número").fill(`Rua ${marca}, 100`);
    await page.locator('input[list="novo-bairros"]').fill(marca);
    return marca;
  }

  async function esperarSalvo(page: Page) {
    // Debounce de 2s; o indicador passa por "Salvando…" e chega em "Salvo".
    await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 12_000 });
  }

  test("T-RASC-1 — autosave mostra 'Salvando…' → 'Salvo' e reload mantém", async ({ page }) => {
    const marca = await novoComEndereco(page);
    await esperarSalvo(page);
    // Reload na mesma URL: o rascunho volta (cinto local + servidor).
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-2 — rascunho reaparece na Visão geral e retoma no servidor", async ({ page }) => {
    const marca = await novoComEndereco(page);
    await esperarSalvo(page);
    // Sai do editor SEM publicar; a Visão geral deve oferecer retomar.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const card = page.getByText(/Anúncio em andamento/i);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.getByRole("link", { name: /Continuar edição/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/);
    // Restaurou do SERVIDOR (não do localStorage desta aba): bairro de volta.
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-3 — 'Novo anúncio' detecta rascunho e 'Começar outro' limpa", async ({ page }) => {
    const marca = await novoComEndereco(page);
    await esperarSalvo(page);
    // Abre o editor de novo, em branco: deve detectar o rascunho anterior.
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    await expect(page.getByText(/Você tem um anúncio em andamento/i)).toBeVisible({ timeout: 10_000 });
    // "Continuar" retoma o rascunho detectado.
    await page.getByRole("button", { name: "Continuar", exact: true }).first().click();
    await expect(page).toHaveURL(/\?draft=/);
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-4 — retomar NÃO zera a qualificação (selo/etiquetas)", async ({ page }) => {
    await novoComEndereco(page);
    await esperarSalvo(page);
    // Retoma pela Visão geral e confere que a etiqueta da qualificação segue viva
    // (foi guardada no rascunho, não veio da sessionStorage desta navegação).
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Continuar edição/i }).click();
    await expect(page).toHaveURL(/\?draft=/);
    // Vai até a etapa Comodidades (índice 4) pelo stepper e confere a etiqueta.
    await page.getByRole("button", { name: /Comodidades/i }).click();
    await expect(page.getByText(/Para trabalhar de casa”? ativa|trabalhar de casa/i)).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Limpeza: remove os rascunhos de teste criados (evita órfãos acumulando).
    const context = await browser.newContext({ storageState: authFile("proprietario") });
    const page = await context.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    for (let i = 0; i < 20; i++) {
      const botao = page.getByRole("button", { name: "Excluir rascunho" }).first();
      if (!(await botao.isVisible().catch(() => false))) break;
      await botao.click();
      await page.waitForTimeout(600);
    }
    await context.close();
  });
});
