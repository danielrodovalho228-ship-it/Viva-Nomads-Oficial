import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { doTipoAoEndereco, noPasso } from "../fixtures/cadastro";

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
    // Sobe foto, espera o autosave e tenta o painel por até 40 s: não cabe nos 45 s padrão.
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, baseBadge: true, tHome: true, tWork: false, score: 5 }));
      } catch {
        /* sem sessionStorage — ignora */
      }
    });
    await page.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
    const comecarOutro = page.getByRole("button", { name: "Começar outro" });
    if (await comecarOutro.isVisible().catch(() => false)) await comecarOutro.click();
    // Assistente em 10 passos: Tipo → Fotos (1 foto) → Endereço; o endereço já cria o rascunho.
    await doTipoAoEndereco(page);
    await page.getByTestId("cadastro-rua").fill("Rua do Score");
    await page.getByTestId("cadastro-numero").fill("10");
    await page.getByTestId("cadastro-bairro").fill("Centro");
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

    // Editar um campo faz o score subir (ordem 0f9b9d58): descrição com 40+ palavras = +6 pontos.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const antes = Number((await page.getByTestId("anuncio-score-valor").innerText()).replace("%", ""));
    // Painel mostra só as dicas que mais valem: com a descrição obrigatória (60+ caracteres, f9753c6), é ela que aparece.
    await page.getByTestId("score-dica").filter({ hasText: /Descrição com/ }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=.*&etapa=6/); // passo 7 dos 10, "Título e descrição"
    await noPasso(page, "descricao");
    const descricao = Array.from({ length: 45 }, (_, i) => `palavra${i}`).join(" ");
    await page.getByTestId("cadastro-descricao").fill(descricao);
    await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const depois = Number((await page.getByTestId("anuncio-score-valor").innerText({ timeout: 4_000 })).replace("%", ""));
      expect(depois).toBeGreaterThan(antes);
    }).toPass({ timeout: 40_000, intervals: [2_000, 3_000] });
  });
});
