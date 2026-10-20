import { test, expect, type Page } from "@playwright/test";

/**
 * Ordem ebc51995 (P0) — Comparar com anúncios de exemplo (ube-001…): o /comparar descartava
 * ids que não eram UUID e mostrava só o estado vazio. Público, 390 e 1280 px.
 * Fluxo inteiro: /buscar → marcar 2 → barra acima das abas → tocar → tabela com os 2 → recarregar
 * → marcar 3 → 4º dá aviso → Limpar. Repetido com 2 imóveis reais (UUID) quando a busca tem.
 */
const UUID_HREF = /\/imoveis\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Índices das marcas cujo cartão aponta para um imóvel; `real` filtra por UUID, senão pega os de exemplo (ube-NNN). */
async function indicesPorTipo(page: Page, real: boolean): Promise<number[]> {
  const hrefs = await page.getByTestId("marcar-comparar").evaluateAll((els) =>
    els.map((el) => el.closest("label")?.parentElement?.querySelector('a[href^="/imoveis/"]')?.getAttribute("href") ?? ""),
  );
  return hrefs.flatMap((h, i) => ((real ? UUID_HREF.test(h) : /\/imoveis\/ube-\d{3}$/.test(h)) ? [i] : []));
}

async function barraAcimaDasAbas(page: Page, largura: number) {
  if (largura >= 768) return;
  const barra = await page.getByTestId("barra-comparar").locator("> div").boundingBox();
  const nav = await page.getByRole("navigation", { name: "Navegação principal" }).boundingBox();
  expect(barra).not.toBeNull();
  expect(nav).not.toBeNull();
  expect(barra!.y + barra!.height).toBeLessThanOrEqual(nav!.y - 8);
}

for (const largura of [390, 1280]) {
  test.describe(`T156 — Comparar anúncios de exemplo (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 844 } });

    test("URL com ube-001,ube-002 mostra a tabela com os 2 e mantém ao recarregar", async ({ page }) => {
      await page.goto("/comparar?comparar=ube-001,ube-002", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("comparar-tabela")).toBeVisible();
      await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
      await expect(page.getByTestId("comparar-vazio")).toHaveCount(0);
    });

    test("texto fora do padrão continua sendo descartado", async ({ page }) => {
      await page.goto("/comparar?comparar=ube-001,ube-1,<script>", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("comparar-vazio")).toBeVisible();
    });

    for (const [rotulo, real] of [["2 de exemplo", false], ["2 imóveis reais (UUID)", true]] as const) {
      test(`fluxo com ${rotulo}: /buscar → marcar → barra acima das abas → tabela → recarregar → 4º dá aviso → Limpar`, async ({ page }) => {
        await page.goto("/buscar", { waitUntil: "domcontentloaded" });
        const marcas = page.getByTestId("marcar-comparar");
        await expect(marcas.first()).toBeVisible();
        const idx = await indicesPorTipo(page, real);
        test.skip(idx.length < 2, `menos de 2 imóveis ${real ? "reais" : "de exemplo"} na busca do ambiente`);

        await marcas.nth(idx[0]).check();
        await barraAcimaDasAbas(page, largura);
        await marcas.nth(idx[1]).check();
        await barraAcimaDasAbas(page, largura);
        await expect(page.getByTestId("comparar-abrir")).toContainText("Comparar (2)");
        await page.getByTestId("comparar-abrir").click();

        await expect(page).toHaveURL(/\/comparar\?comparar=[\w-]+,[\w-]+/);
        await expect(page.getByTestId("comparar-tabela")).toBeVisible();
        await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
        await page.screenshot({ path: `tests/laboratorio/saida/t156-comparar-${real ? "real" : "exemplo"}-${largura}.png`, fullPage: true });

        await page.goBack({ waitUntil: "domcontentloaded" });
        await expect(marcas.first()).toBeVisible();
        const todos = await marcas.count();
        test.skip(todos < 4, "menos de 4 imóveis na busca para testar o limite");
        const marcados = new Set(idx.slice(0, 2));
        // 3º: qualquer outro cartão; 4º: mais um, que deve ser recusado com aviso.
        const outros = [...Array(todos).keys()].filter((i) => !marcados.has(i));
        await marcas.nth(idx[0]).check();
        await marcas.nth(idx[1]).check();
        await marcas.nth(outros[0]).check();
        await marcas.nth(outros[1]).check({ force: true }).catch(() => {});
        await expect(page.getByTestId("comparar-aviso")).toContainText("até 3 imóveis");
        await expect(marcas.nth(outros[1])).not.toBeChecked();
        await page.getByTestId("comparar-limpar").click();
        await expect(page.getByTestId("barra-comparar")).toHaveCount(0);
        await expect(marcas.nth(idx[0])).not.toBeChecked();
      });
    }
  });
}
