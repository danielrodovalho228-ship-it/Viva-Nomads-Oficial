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
  // Em ordem, num worker só: os testes deste arquivo mexem no MESMO estado da
  // conta (modo preferido / rascunhos) e se atrapalhavam com fullyParallel.
  test.describe.configure({ mode: "default" });
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
    // Bug 12: o 1º autosave fixa ?draft=<id> na URL (F5 retoma o mesmo rascunho).
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/);
    const id = new URL(page.url()).searchParams.get("draft");
    // Abre o editor de novo, em branco: deve detectar o rascunho anterior, sem
    // aplicar a cópia local nem criar outro rascunho por baixo (bug 12).
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    await expect(page.getByText(/Você tem um anúncio em andamento/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000); // passa o debounce do autosave
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo$/);
    await expect(page.getByText(/Você tem um anúncio em andamento/i)).toBeVisible();
    // "Continuar" retoma o rascunho detectado.
    await page.getByRole("button", { name: "Continuar", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`\\?draft=${id}`));
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-4 — retomar não trava etapas já visitadas nem zera a qualificação (bug 13)", async ({ page }) => {
    await novoComEndereco(page);
    // Percorre até Comodidades pelo "Continuar" (cada etapa valida o mínimo).
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("Banheiros", { exact: true }).fill("1");
    await page.getByLabel("Área (m²)", { exact: true }).fill("45");
    await page.getByLabel(/Capacidade máxima/).fill("2");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.locator('input[type="file"]').first().setInputFiles("public/images/imoveis/ube/ube-001-sala.webp");
    await expect(page.getByText(/^1\/24 fotos/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Comodidades" })).toBeVisible();
    // Volta ao Endereço pelo topo e deixa salvar: o rascunho fica na etapa 2.
    await page.getByRole("button", { name: /Endereço/ }).click();
    await esperarSalvo(page);
    await page.waitForTimeout(2_500);
    await esperarSalvo(page);
    // Retoma pela Visão geral: abre no Endereço, e Comodidades segue clicável.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Continuar edição/i }).click();
    await expect(page).toHaveURL(/\?draft=/);
    await expect(page.getByPlaceholder("Rua, número")).toBeVisible();
    const comodidades = page.getByRole("button", { name: /Comodidades/i });
    await expect(comodidades).toBeEnabled();
    await expect(page.getByRole("button", { name: /Preço/i })).toBeDisabled(); // nunca visitada
    await comodidades.click();
    // A etiqueta da qualificação veio do rascunho (não da sessionStorage).
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
