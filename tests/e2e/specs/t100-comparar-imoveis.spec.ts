import { test, expect, type Locator, type APIRequestContext } from "@playwright/test";

/**
 * A busca fica em cache por 60 s e pode listar anúncio que outro spec já apagou (o /imoveis/<id> dá 404 e o
 * /comparar devolve "Escolha de 2 a 3 imóveis"). Devolve os índices das marcas cujo anúncio ainda abre.
 */
async function indicesQueAbrem(marcas: Locator, request: APIRequestContext): Promise<number[]> {
  const total = await marcas.count();
  const abertos: number[] = [];
  for (let i = 0; i < total; i++) {
    const href = await marcas
      .nth(i)
      .evaluate((el) => el.closest("label")?.parentElement?.querySelector('a[href^="/imoveis/"]')?.getAttribute("href") ?? null);
    if (!href) continue;
    const resp = await request.get(href);
    if (resp.status() === 200) abertos.push(i);
  }
  return abertos;
}

/**
 * T100 — Comparar imóveis lado a lado (ordem fdd61de0). Público/anônimo.
 * Marca 2 cards na busca → "Comparar (2)" → tabela com os valores; 4º imóvel mostra aviso;
 * a seleção vive na URL (?comparar=) e a tabela não passa de 390 px de largura da página.
 */
test.describe("T100 — Comparar imóveis", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test("marcar 2 → comparar → ver os valores; 4º dá aviso", async ({ page, request }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const marcas = page.getByTestId("marcar-comparar");
    await expect(marcas.first()).toBeVisible();
    const ok = await indicesQueAbrem(marcas, request);
    test.skip(ok.length < 2, "menos de 2 imóveis que abrem na busca do ambiente");

    await marcas.nth(ok[0]).check();
    await expect(page.getByTestId("barra-comparar")).toContainText("Comparar (1)");
    await marcas.nth(ok[1]).check();
    await expect(page.getByTestId("comparar-abrir")).toContainText("Comparar (2)");

    if (ok.length >= 4) {
      await marcas.nth(ok[2]).check();
      await marcas.nth(ok[3]).check({ force: true }).catch(() => {});
      await expect(page.getByTestId("comparar-aviso")).toContainText("até 3 imóveis");
      await expect(marcas.nth(ok[3])).not.toBeChecked();
      await marcas.nth(ok[2]).uncheck();
    }

    await page.getByTestId("comparar-abrir").click();
    await expect(page).toHaveURL(/\/comparar\?comparar=[0-9a-f-]{36},[0-9a-f-]{36}/);
    const tabela = page.getByTestId("comparar-tabela");
    await expect(tabela).toBeVisible();
    await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
    for (const l of ["Valor mensal", "Quartos", "Banheiros", "Área (m²)", "Aceita pet", "Avaliação"]) {
      await expect(tabela.getByRole("rowheader", { name: l })).toBeVisible();
    }
    await expect(tabela.locator('[data-linha="mensal"] td').first()).toContainText(/R\$|—/);
    // sem dado pessoal nem coordenada exata
    await expect(page.locator("body")).not.toContainText(/-?\d{1,2}\.\d{5,}/);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0); // a rolagem fica dentro da tabela, não na página
    await page.screenshot({ path: "tests/laboratorio/saida/t100-comparar-390.png", fullPage: true });
  });

  test("a 1280 px a tabela cabe inteira, sem rolagem lateral", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const marcas = page.getByTestId("marcar-comparar");
    await expect(marcas.first()).toBeVisible();
    const ok = await indicesQueAbrem(marcas, request);
    test.skip(ok.length < 2, "menos de 2 imóveis que abrem na busca do ambiente");
    await marcas.nth(ok[0]).check();
    await marcas.nth(ok[1]).check();
    await page.getByTestId("comparar-abrir").click();
    const tabela = page.getByTestId("comparar-tabela");
    await expect(tabela).toBeVisible();
    await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
    const { pagina, tab } = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="comparar-tabela"]') as HTMLElement;
      return { pagina: document.documentElement.scrollWidth - window.innerWidth, tab: el.scrollWidth - el.clientWidth };
    });
    expect(pagina).toBeLessThanOrEqual(0);
    expect(tab).toBeLessThanOrEqual(1); // desktop: nada escondido dentro da tabela
    await page.screenshot({ path: "tests/laboratorio/saida/t100-comparar-1280.png", fullPage: true });
  });

  test("sem seleção válida mostra orientação, nunca quebra", async ({ page }) => {
    await page.goto("/comparar?comparar=lixo,<script>", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("comparar-vazio")).toContainText("Escolha de 2 a 3 imóveis");
  });
});
