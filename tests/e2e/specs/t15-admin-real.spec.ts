import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T15 — PAINEL DE ADMIN COM DADOS REAIS. Regressão do painel que mostrava
 * números e uma fila de checklists escritos no código (Marcos A., Patrícia L.,
 * Família Souza; "Usuários: 28") e "Aprovado" sem gravar nada.
 */
test.describe("T15 — Admin real", () => {
  test.use({ storageState: authFile("admin") });

  test("/admin não tem dados de exemplo e mostra os números do banco", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    // Prompt 46: o /admin abre com as decisões ("Hoje você tem N decisões" / "Nada pede sua decisão hoje").
    await expect(page.getByRole("heading", { level: 1, name: /decis/ })).toBeVisible();
    const corpo = page.locator("main");
    for (const falso of ["Marcos A.", "Patrícia L.", "Família Souza", "Apto Santa Mônica", "Casa Tibery"]) {
      await expect(corpo).not.toContainText(falso);
    }
    // Cartões de contagem presentes (o valor vem do banco; "—" só sem conexão).
    await expect(corpo.getByText("Usuários", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("admin-heroi")).toContainText("Imóveis reais publicados");
    // A fila de checklists (sempre vazia: a qualificação nunca fica pendente)
    // saiu; o portão humano é o documento, com link para a fila dele.
    await expect(corpo).not.toContainText("Checklists pendentes");
    // Cada decisão leva à tela do admin onde ela é tomada (a de documentos só aparece com fila).
    for (const link of await page.getByTestId("admin-decisoes").locator("[data-href]").all()) {
      expect(await link.getAttribute("data-href")).toMatch(/^\/admin/);
    }
    const docs = page.locator('[data-decisao="documentos_pendentes"] [data-href]');
    if (await docs.count()) await expect(docs).toHaveAttribute("href", "/admin/documentos");
    await expect(corpo).not.toContainText("modo demonstração");
  });

  test("visão geral: período, cidade, fórmula no i e nada de NaN/Infinity", async ({ page }) => {
    for (const periodo of ["7", "30", "90", "ano"]) {
      await page.goto(`/admin?periodo=${periodo}`, { waitUntil: "networkidle" });
      const corpo = page.locator("main");
      await expect(page.getByTestId("admin-decisoes")).toBeVisible();
      const texto = await corpo.innerText();
      expect(texto, `periodo=${periodo}`).not.toMatch(/NaN|Infinity/);
      // Nunca "0%" com denominador zero: cartão de % sem base mostra "—".
      for (const card of await corpo.locator("[data-indicador]").all()) {
        const valor = (await card.locator("[data-valor]").innerText()).trim();
        expect(valor).not.toMatch(/NaN|Infinity/);
      }
      await expect(corpo.getByRole("link", { name: { "7": "7 dias", "30": "30 dias", "90": "90 dias", ano: "Ano" }[periodo] })).toHaveAttribute("aria-current", "true");
    }
    // O "i" abre a fórmula; o valor total avisa que não passa pela plataforma (Prompt 29).
    await page.getByRole("button", { name: "Como é calculado: Valor total dos contratos" }).click();
    await expect(page.locator("main")).toContainText("não passa pela plataforma");
    // Período inválido cai em 30 dias, sem erro.
    await page.goto("/admin?periodo=custom&de=2026-02-31&ate=lixo", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "30 dias" })).toHaveAttribute("aria-current", "true");
    // Cidade inexistente: tudo "—"/0, nada quebra.
    await page.goto("/admin?periodo=30&cidade=Cidade%20Que%20Nao%20Existe", { waitUntil: "networkidle" });
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity/);
  });

  test("financeiro: números honestos, \"i\" e aviso do aluguel", async ({ page }) => {
    for (const periodo of ["7", "30", "ano"]) {
      await page.goto(`/admin/financeiro?periodo=${periodo}`, { waitUntil: "networkidle" });
      const corpo = page.locator("main");
      await expect(corpo.getByRole("heading", { name: "Financeiro", level: 1 })).toBeVisible();
      expect(await corpo.innerText(), `periodo=${periodo}`).not.toMatch(/NaN|Infinity|undefined/);
    }
    await expect(page.locator("main")).toContainText("não passa pela plataforma");
    await page.getByRole("button", { name: "Como é calculado: LTV" }).click();
    await expect(page.locator("main")).toContainText("ARPU ÷ churn mensal");
    // Filtro de cidade: assinaturas e marketing viram "—" (não têm cidade).
    await page.goto("/admin/financeiro?periodo=30&cidade=Cidade%20Que%20Nao%20Existe", { waitUntil: "networkidle" });
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);
  });

  test("moderação de pedidos não usa a janelinha do navegador", async ({ page }) => {
    let abriuPrompt = false;
    page.on("dialog", async (d) => {
      abriuPrompt = true;
      await d.dismiss();
    });
    await page.goto("/admin/pedidos", { waitUntil: "networkidle" });
    const ocultar = page.getByRole("button", { name: /Ocultar/ }).first();
    test.skip((await ocultar.count()) === 0, "nenhum pedido ativo para testar");
    await ocultar.click();
    await expect(page.getByRole("dialog", { name: "Ocultar pedido" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    expect(abriuPrompt).toBe(false);
  });
});
