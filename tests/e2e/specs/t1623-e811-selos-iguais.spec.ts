import { test, expect } from "@playwright/test";

/*
  T1623 — E811: o cartão da busca e a página do anúncio mostram os MESMOS selos (fonte única simbolosDoImovel), cada um
  com o critério visível na página; a página não acrescenta "Pronto para Morar" sobre a foto nem as etiquetas de trabalho
  como selo; pets inequívoco (ube-003: selo "Aceita pets" + linha "Animais" nas regras). Exemplos ube-001, 002 e 003.
*/
const IDS = ["ube-001", "ube-002", "ube-003"];

test.describe("E811 — selos iguais no cartão e na página", () => {
  test("cartão × página: mesma lista de selos, critério visível, sem selos a mais", async ({ page }) => {
    await page.goto("/buscar?exemplos=1", { waitUntil: "networkidle" });
    const doCartao: Record<string, string[]> = {};
    for (const id of IDS) {
      const cartao = page.locator(`a[href="/imoveis/${id}"]`).first().locator("xpath=ancestor::*[@data-testid='cartao-imovel'][1]");
      await expect(cartao).toBeVisible();
      doCartao[id] = await cartao.locator('[data-testid="selos-foto"] [data-selo]').evaluateAll((els) =>
        els.map((e) => e.getAttribute("data-selo") ?? "").filter((s) => s && !["essencial", "conforto", "premium"].includes(s)),
      );
    }
    for (const id of IDS) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      const naPagina = await page.locator('[data-testid="selos-anuncio"] [data-selo]').evaluateAll((els) => els.map((e) => e.getAttribute("data-selo") ?? ""));
      expect(naPagina, id).toEqual(doCartao[id]);
      if (naPagina.length > 0) await expect(page.getByTestId("selos-criterios").locator("li")).toHaveCount(naPagina.length);
      // Nada de "Pronto para Morar" sobre a foto nem as etiquetas de trabalho como selo.
      await expect(page.locator("main").getByText("Pronto para Morar", { exact: true })).toHaveCount(0);
      await expect(page.locator("main").getByText("Bem localizado p/ trabalho", { exact: true })).toHaveCount(0);
    }
  });

  test("pets inequívoco no ube-003: selo + critério + linha 'Animais'", async ({ page }) => {
    await page.goto("/imoveis/ube-003", { waitUntil: "networkidle" });
    await expect(page.getByTestId("selos-anuncio").getByText("Aceita pets")).toBeVisible();
    await expect(page.getByTestId("selos-criterios")).toContainText("Aceita pets:");
    await expect(page.locator("main")).toContainText(/Animais\s*Aceita pets/);
  });
});
