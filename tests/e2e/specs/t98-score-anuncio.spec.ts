import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T98 — Score de qualidade do anúncio (ordem 0f9b9d58): o card "Anúncio em andamento"
 * da Visão geral mostra a barra + número e dicas clicáveis que levam à etapa certa.
 * O cálculo (anúncio vazio, parcial, completo, "campo editado sobe o score") é provado
 * nos unitários de src/lib/anuncio/score.test.ts.
 */
test.describe("T98 — Score de qualidade do anúncio", () => {
  test.describe.configure({ mode: "default" });
  test.use({ storageState: authFile("proprietario") });

  test("rascunho mostra o score e a dica abre o campo certo (390 px)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, baseBadge: true, tHome: true, tWork: false, score: 5 }));
      } catch {
        /* sem sessionStorage — ignora */
      }
    });
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    const comecarOutro = page.getByRole("button", { name: "Começar outro" });
    if (await comecarOutro.isVisible().catch(() => false)) await comecarOutro.click();
    await page.locator('input[type="file"]').first().setInputFiles("public/images/imoveis/ube/ube-001-sala.webp");
    await expect(page.getByText(/^1\/40 fotos/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 20_000 });

    await expect(async () => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("anuncio-score")).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 40_000, intervals: [2_000, 3_000] });

    const valor = await page.getByTestId("anuncio-score-valor").innerText();
    expect(Number(valor.replace("%", ""))).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

    const dicas = page.getByTestId("score-dica");
    await expect(dicas.first()).toBeVisible();
    await dicas.first().click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=.*&etapa=\d/);

    // Prova da ordem 0f9b9d58 (editar campo → score sobe): preenche título e descrição
    // (obrigatórios do mesmo checklist) no rascunho, deixa salvar e confere o número maior.
    const draftId = new URL(page.url()).searchParams.get("draft");
    expect(draftId).toBeTruthy();
    await page.goto(`/dashboard/imoveis/novo?draft=${encodeURIComponent(draftId!)}&etapa=5`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Título do anúncio").fill("Studio mobiliado perto da universidade");
    await page.getByLabel("Descrição", { exact: true }).fill(
      "Studio mobiliado, silencioso e bem iluminado, com cozinha equipada, internet rápida e roupa de cama incluída, perto de mercado e transporte.",
    );
    // O rascunho salva sozinho com um pequeno atraso: espera antes de sair da tela.
    await page.waitForTimeout(4_000);
    await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 20_000 });

    await expect(async () => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("anuncio-score-valor")).toBeVisible({ timeout: 4_000 });
      const depois = Number((await page.getByTestId("anuncio-score-valor").innerText()).replace("%", ""));
      expect(depois).toBeGreaterThan(Number(valor.replace("%", "")));
    }).toPass({ timeout: 45_000, intervals: [2_000, 3_000, 5_000] });
  });
});
