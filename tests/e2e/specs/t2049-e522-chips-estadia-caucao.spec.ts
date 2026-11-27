import { test, expect, type Page } from "@playwright/test";

/*
  T2049 — E522 (Pista 3, cobertura do mapa das 142; autorizado pelo Gerente em 15/11) @E522 @ao-vivo-seguro
  Regra: os chips de "Mais filtros" — Estadia (1–2 / 3–4 / 5–6 meses) e Contrato › Caução — FILTRAM de verdade: o chip
  tocado fica ativo, o "Mostrar N" passa a ser o número do próprio chip (a mesma regra da lista), e ao aplicar o filtro
  vai para o endereço e a lista mostra exatamente N anúncios (também depois de recarregar).
  Visitante, só leitura. Vale para qualquer catálogo: no de exemplo todas as faixas dão o mesmo número (é o que o E522
  explicou), mas o chip ativo, o endereço e a lista = contagem continuam valendo.
*/
test.use({ storageState: { cookies: [], origins: [] } });

async function abrirFolha(page: Page) {
  const folha = page.getByTestId("painel-filtros");
  // O botão existe antes da hidratação: repete o toque até a folha abrir (sem isso, o 1º clique pode se perder).
  await expect(async () => {
    if (!(await folha.isVisible())) await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(folha).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return folha;
}

for (const chip of [
  { testid: "faceta-estadia-60", param: "periodo=60" },
  { testid: "faceta-estadia-120", param: "periodo=120" },
  { testid: "faceta-estadia-180", param: "periodo=180" },
  { testid: "faceta-garantia-caucao", param: "garantia=caucao" },
]) {
  test(`T2049 — E522: o chip ${chip.testid} filtra (ativo, Mostrar N = chip, endereço e lista) @E522 @ao-vivo-seguro`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    const folha = await abrirFolha(page);
    const alvo = folha.getByTestId(chip.testid);
    await expect(alvo).toBeVisible();
    const n = Number(await alvo.getAttribute("data-n"));
    expect(Number.isInteger(n)).toBe(true);
    test.skip(n === 0 || (await alvo.isDisabled()), "Neste catálogo nenhum anúncio cabe neste chip (desabilitado): nada a filtrar.");
    await expect(alvo).toHaveAttribute("aria-pressed", "false");
    await alvo.click();
    await expect(alvo).toHaveAttribute("aria-pressed", "true");
    await expect(folha.getByTestId("aplicar-filtros")).toHaveAttribute("data-total", String(n));
    await folha.getByTestId("aplicar-filtros").click();
    await expect(page.getByTestId("painel-filtros")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`[?&]${chip.param}(&|$)`));
    await expect(page.getByTestId("card-resultado")).toHaveCount(n, { timeout: 15_000 });
    await expect(page.getByTestId("titulo-busca")).toContainText(String(n));
    // Recarregando o endereço, o filtro continua valendo.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado")).toHaveCount(n, { timeout: 30_000 });
  });
}
