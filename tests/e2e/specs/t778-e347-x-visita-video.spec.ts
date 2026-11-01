import { test, expect, type Page } from "@playwright/test";

/*
  T778 — E347 (01/11): o diálogo "Visita por vídeo" do ube-001 tem o X de fechar, como o lightbox da galeria
  (IconButton "Fechar"); "Voltar" e o clique fora continuam fechando. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

async function abrir(page: Page) {
  const botao = page.getByTestId("visita-video-abrir").first();
  await botao.scrollIntoViewIfNeeded();
  await expect(async () => {
    if (!(await page.getByTestId("visita-video-passo").isVisible())) await botao.click({ timeout: 3_000 });
    await expect(page.getByTestId("visita-video-passo")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

for (const largura of [390, 1280] as const) {
  test(`T778 — E347: X de fechar na visita por vídeo, mantendo Voltar e clique fora (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");
    const folha = page.getByTestId("visita-video-passo");

    await abrir(page);
    const x = folha.getByRole("button", { name: "Fechar" });
    await expect(x).toBeVisible();
    await expect(x).toHaveAttribute("data-testid", "visita-video-fechar");
    const caixa = await x.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(40);
    await page.screenshot({ path: `${SAIDA}/t778-x-${largura}.png` });
    await x.click();
    await expect(folha).toHaveCount(0);

    await abrir(page);
    await folha.getByRole("button", { name: "Voltar" }).click();
    await expect(folha).toHaveCount(0);

    await abrir(page);
    await page.mouse.click(5, 5);
    await expect(folha).toHaveCount(0);
  });
}
