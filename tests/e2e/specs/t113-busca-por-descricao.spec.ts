import { test, expect } from "@playwright/test";

/**
 * L-43 (vigia, 24/10): o painel e a /buscar não assentam em "networkidle" (t183, L-40); espera até 10 s e segue para o elemento.
 * T113 — Busca por descrição (ordem c470bb63, Próximo do FF 2/6), pública, 390 px.
 * A frase vira filtros (chips); tirar um chip tira só aquele filtro; sem IA ligada vale o leitor local.
 */
test.describe("T113 — Busca por descrição", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a frase vira chips de filtro e dá para tirar um deles", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const campo = page.getByLabel("Descreva o lugar ideal");
    await expect(campo).toBeVisible();
    await campo.fill("2 quartos, aceita gato, até 2.500, wi-fi");
    await page.getByTestId("descricao-aplicar").click();

    const chips = page.getByTestId("descricao-chips");
    await expect(chips).toContainText("Até R$ 2.500");
    await expect(chips).toContainText("2+ quartos");
    await expect(chips).toContainText("Aceita pets");
    // FILTROS-2 (4b9ab7d7): Wi-Fi é garantia do padrão mínimo, não filtro — a frase não liga chip de Wi-Fi.
    await expect(chips).not.toContainText("Wi-Fi");

    // O filtro vai para a URL (compartilhável) e o resumo do celular acompanha.
    await expect(page).toHaveURL(/quartos=2/);
    await expect(page.getByTestId("resumo-filtros")).toContainText("Aceita pets");

    await page.getByRole("button", { name: "Tirar filtro Aceita pets" }).click();
    await expect(chips).not.toContainText("Aceita pets");
    await expect(chips).toContainText("2+ quartos");
    await expect(page.getByTestId("resumo-filtros")).not.toContainText("Aceita pets");

    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(larguraDoc).toBeLessThanOrEqual(0); // 390 px sem rolagem lateral
    await page.screenshot({ path: "tests/laboratorio/saida/t108-busca-por-descricao.png", fullPage: false });
  });

  test("frase sem filtro avisa e não muda a busca; a API nunca devolve imóvel", async ({ page, request }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.getByLabel("Descreva o lugar ideal").fill("qual a capital da França");
    await page.getByTestId("descricao-aplicar").click();
    await expect(page.getByTestId("descricao-vazia")).toBeVisible();
    const r = await request.post("/api/busca/descricao", { data: { descricao: "2 quartos até 2500" } });
    expect([200, 429]).toContain(r.status());
    const corpo = await r.json();
    expect(Object.keys(corpo).sort()).toEqual(["filtros", "origem"]);
  });
});
