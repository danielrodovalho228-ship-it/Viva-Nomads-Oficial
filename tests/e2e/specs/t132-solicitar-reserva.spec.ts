import { test, expect } from "@playwright/test";

/**
 * T132 — "Solicitar" (Prompt 41; antes "Enviar candidatura") nunca fica mudo (complemento 2 da ordem 4f8023d1).
 * Anúncio de exemplo (ube-001): clicar abre o passo de confirmação com o resumo
 * (entrada, motivo, valores) e o aviso de demonstração; nada é gravado.
 * Data no passado: mensagem visível, sem seguir.
 */
const DEMO = /Demonstração: este anúncio é de exemplo e a solicitação não é enviada/;

for (const [nome, largura, altura] of [["1280", 1280, 900], ["390", 390, 844]] as const) {
  test.describe(`T132 — ${nome} px`, () => {
    test("com data e motivo preenchidos, clicar abre o resumo e o aviso; nada é gravado", async ({ page }) => {
      const gravacoes: string[] = [];
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const card = page.locator("#cartao-preco");
      await card.getByTestId("candidatura-inicio").fill("2099-01-10");
      await card.getByTestId("candidatura-motivo").selectOption("trabalho_remoto");
      page.on("request", (r) => {
        if (r.method() === "POST") gravacoes.push(r.url());
      });
      const gatilho = largura >= 1024 ? card : page.getByTestId("barra-fixa-imovel");
      await gatilho.getByRole("button", { name: "Solicitar", exact: true }).click();
      const passo = page.getByTestId("solicitacao-passo");
      await expect(passo).toBeVisible();
      // E53: no Revisar a entrada vem no campo editável do diálogo (a mesma seleção da caixa e do calendário).
      await expect(passo.getByTestId("solicitacao-inicio")).toHaveValue("2099-01-10");
      await expect(passo).toContainText("Trabalho remoto");
      await expect(passo).toContainText("devolvida no fim");
      await expect(passo.getByTestId("solicitacao-demo")).toHaveText(DEMO);
      await expect(passo.getByRole("button", { name: "Enviar solicitação" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await passo.getByRole("button", { name: "Entendi" }).click();
      await expect(passo).toHaveCount(0);
      expect(gravacoes).toEqual([]);
    });

    test("data de entrada no passado: mensagem visível", async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const card = page.locator("#cartao-preco");
      await card.getByTestId("candidatura-inicio").evaluate((el: HTMLInputElement) => {
        el.removeAttribute("min");
      });
      await card.getByTestId("candidatura-inicio").fill("2020-01-10");
      const gatilho = largura >= 1024 ? card : page.getByTestId("barra-fixa-imovel");
      await gatilho.getByRole("button", { name: "Solicitar", exact: true }).click();
      await expect(page.getByTestId("solicitacao-erro")).toContainText("hoje ou depois");
    });
  });
}
