import { test, expect, devices } from "@playwright/test";

/**
 * T1158 — E590 (relato do Daniel, celular, 05/11): "Nível" na barra da busca sem as opções. Diagnóstico: não é defeito
 * de celular — o painel é o mesmo componente em qualquer largura e, com anúncios que têm nível, as 3 opções abrem e
 * aplicam por toque. Em produção (leitura de 05/11) os únicos anúncios com nível em Uberlândia são de TESTE (8
 * "essencial", o "Essencial ou acima · 8" da prova de 04/11 com conta de teste); para quem não é conta de teste, a
 * busca só tem os de demonstração, sem nível, e o painel mostra o aviso de "sem níveis" (TEXTO_SEM_NIVEIS).
 * Guarda: no celular (toque), cada pílula da barra — Datas, Tipo, Preço, Nível, Ordenar — abre o painel DENTRO da tela,
 * com conteúdo (opções ou o aviso do nível), e Tipo/Preço/Ordenar/Nível aplicam (URL e pílula). @criticos
 */
test.use({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });

const URL_BUSCA = "/buscar?local=Uberl%C3%A2ndia";

async function abrir(page: import("@playwright/test").Page, pilula: string) {
  await expect(async () => {
    await page.goto(URL_BUSCA, { waitUntil: "domcontentloaded" });
    await page.getByTestId(`pilula-${pilula}`).tap({ timeout: 5_000 });
    await expect(page.getByTestId(`painel-pilula-${pilula}`)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  const painel = page.getByTestId(`painel-pilula-${pilula}`);
  const box = (await painel.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x, `${pilula}: painel dentro da tela (esquerda)`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${pilula}: painel dentro da tela (direita)`).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y, `${pilula}: painel começa dentro da tela`).toBeLessThan(vp.height - 40);
  return painel;
}

test("celular: Datas, Tipo, Preço, Nível e Ordenar abrem dentro da tela e aplicam por toque @criticos", async ({ page }) => {
  test.setTimeout(240_000);

  // Datas: o campo de entrada e os moradores.
  const datas = await abrir(page, "datas");
  await expect(datas.getByTestId("pilula-datas-entrada")).toBeVisible();
  await expect(datas.getByTestId("pilula-datas-moradores")).toBeVisible();

  // Tipo e Preço: a primeira opção com imóvel aplica (URL + pílula).
  for (const [pilula, prefixo, param] of [["tipo", "pilula-tipo-", "tipo="], ["preco", "pilula-preco-", "preco="]] as const) {
    const painel = await abrir(page, pilula);
    const opcao = painel.locator(`[data-testid^="${prefixo}"]:not([disabled])`).first();
    await expect(opcao, `${pilula}: há opção para tocar`).toBeVisible();
    await opcao.tap();
    await expect(page).toHaveURL(new RegExp(param));
    await expect(page.getByTestId(`pilula-${pilula}`)).not.toHaveAttribute("data-valor", "");
  }

  // Nível: as 3 opções com contador (e a primeira com imóvel aplica) OU, sem nível nenhum na busca, o aviso.
  const nivel = await abrir(page, "nivel");
  const opcoes = nivel.locator('[data-testid^="pilula-nivel-"]:not([data-testid$="-n"])');
  if ((await opcoes.count()) > 0) {
    await expect(opcoes).toHaveCount(3);
    for (const v of ["essencial", "conforto", "premium"]) await expect(nivel.getByTestId(`pilula-nivel-${v}-n`)).toBeVisible();
    const comImovel = nivel.locator('[data-testid^="pilula-nivel-"]:not([data-testid$="-n"]):not([disabled])').first();
    if ((await comImovel.count()) > 0) {
      await comImovel.tap();
      await expect(page).toHaveURL(/nivel=/);
    }
  } else {
    await expect(nivel.getByTestId("painel-nivel-vazio")).toBeVisible();
  }

  // Ordenar: tocar aplica e fecha.
  const ordenar = await abrir(page, "ordenar");
  await ordenar.getByTestId("pilula-ordem-price-asc").tap();
  await expect(page).toHaveURL(/ordem=price-asc/);
  await expect(page.getByTestId("painel-pilula-ordenar")).toHaveCount(0);
});
