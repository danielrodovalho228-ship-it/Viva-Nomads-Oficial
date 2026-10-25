import { test, expect } from "@playwright/test";

/**
 * L-43 (vigia, 24/10): o painel e a /buscar não assentam em "networkidle" (t183, L-40); espera até 10 s e segue para o elemento.
 * T113 — Busca por descrição (ordem c470bb63, Próximo do FF 2/6), pública, 390 px.
 * A frase vira filtros (chips); tirar um chip tira só aquele filtro; sem IA ligada vale o leitor local.
 * E82-A: a descrição saiu da página — "Descrever o que procuro" (linha da contagem) abre uma folha, que fecha ao
 * aplicar. Os filtros da frase aparecem na URL e nas pílulas; um filtro se tira sozinho pela folha de filtros.
 */
test.describe("T113 — Busca por descrição", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a frase vira chips de filtro e dá para tirar um deles", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.getByTestId("abrir-descrever").click();
    const folha = page.getByTestId("folha-descrever");
    const campo = folha.getByLabel("Descreva o lugar ideal");
    await expect(campo).toBeVisible();
    await campo.fill("2 quartos, aceita gato, até 2.500, wi-fi");
    await folha.getByTestId("descricao-aplicar").click();
    // E82-A: aplicar fecha a folha — os chips da descrição não ficam na página; os filtros, sim.
    await expect(folha).toHaveCount(0);

    // O filtro vai para a URL (compartilhável) e as pílulas acompanham.
    await expect(page).toHaveURL(/quartos=2/);
    await expect(page).toHaveURL(/pet=1/);
    await expect(page).toHaveURL(/preco=2500/);
    await expect(page.getByTestId("pilula-preco")).toHaveAttribute("data-valor", "Até R$ 2.500");
    await expect(page.getByTestId("pilula-mais")).toContainText(/\(\d+\)/);
    // FILTROS-2: Wi-Fi é garantia do padrão mínimo, não filtro — a frase o cita, mas não vira filtro.
    await expect(page).not.toHaveURL(/comod=[^&]*wifi/);

    // Tirar um filtro tira só aquele: o preço sai pela própria pílula (vale na hora, mesmo com a lista vazia — a folha
    // não aplica um conjunto que continua sem resultado).
    await page.getByTestId("pilula-preco").click();
    await page.getByTestId("painel-pilula-preco").getByTestId("pilula-preco-2500").click();
    await expect(page).not.toHaveURL(/preco=2500/);
    await expect(page.getByTestId("pilula-preco")).toHaveAttribute("data-valor", "");
    await expect(page).toHaveURL(/quartos=2/);
    await expect(page).toHaveURL(/pet=1/);
    await page.keyboard.press("Escape");

    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(larguraDoc).toBeLessThanOrEqual(0); // 390 px sem rolagem lateral
    await page.screenshot({ path: "tests/laboratorio/saida/t108-busca-por-descricao.png", fullPage: false });
  });

  test("frase sem filtro avisa e não muda a busca; a API nunca devolve imóvel", async ({ page, request }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.getByTestId("abrir-descrever").click();
    const folha = page.getByTestId("folha-descrever");
    await folha.getByLabel("Descreva o lugar ideal").fill("qual a capital da França");
    await folha.getByTestId("descricao-aplicar").click();
    // Sem filtro, a folha fica aberta com o aviso.
    await expect(folha.getByTestId("descricao-vazia")).toBeVisible();
    const r = await request.post("/api/busca/descricao", { data: { descricao: "2 quartos até 2500" } });
    expect([200, 429]).toContain(r.status());
    const corpo = await r.json();
    expect(Object.keys(corpo).sort()).toEqual(["filtros", "origem"]);
  });
});
