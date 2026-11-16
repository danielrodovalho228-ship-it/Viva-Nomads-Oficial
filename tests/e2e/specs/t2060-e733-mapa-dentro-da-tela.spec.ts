import { test, expect, type Page } from "@playwright/test";

/*
  T2060 — E733 (Pista 3; autorizado pelo Gerente em 17/11) @E733 @ao-vivo-seguro
  Regra (correção #3433, medida pelo QA nas rodadas 01:30, 05:30, 07:00 e 14:15 de 09/11): em /buscar, com o contador
  "Mais filtros (1)" ou "(2)", o "Mapa" NÃO é empurrado para fora da tela — quebra para a linha seguinte se preciso,
  inteiro e tocável. "Mais filtros", "Ordenar" e "Mapa" ficam dentro da tela; a página não rola de lado. Tudo a 320,
  360, 390 e 1280 px. O anúncio diz "Ver o caminho para morar" (nunca o antigo "Ver o caminho de reserva").
  É a trava de regressão que falta para fechar o item. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const LARGURAS = [320, 360, 390, 1280];
const ESTADOS = [
  { nome: "sem filtro", query: "", rotulo: /^Mais filtros$/ },
  { nome: "1 filtro", query: "&pet=1", rotulo: /^Mais filtros \(1\)$/ },
  { nome: "2 filtros", query: "&pet=1&garantia=caucao", rotulo: /^Mais filtros \(2\)$/ },
];

async function dentroDaTela(page: Page, testId: string, largura: number) {
  const el = page.getByTestId(testId).first();
  await expect(el, `${testId} visível`).toBeVisible();
  const caixa = await el.boundingBox();
  expect(caixa, `${testId} com caixa`).not.toBeNull();
  expect(caixa!.x, `${testId}: borda esquerda dentro da tela`).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width, `${testId}: borda direita dentro da tela (${largura} px)`).toBeLessThanOrEqual(largura);
  // Tocável: o ponto do meio do botão é o próprio botão (ou algo dentro dele), não outra coisa por cima.
  const tocavel = await el.evaluate((n) => {
    const r = n.getBoundingClientRect();
    const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!alvo && (alvo === n || n.contains(alvo));
  });
  expect(tocavel, `${testId} tocável`).toBe(true);
}

for (const largura of LARGURAS) {
  for (const estado of ESTADOS) {
    test(`T2060 — E733: a ${largura} px, ${estado.nome}, o Mapa fica dentro da tela e a busca não rola de lado @E733 @ao-vivo-seguro`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura >= 1024 ? 900 : 800 });
      const r = await page.goto(`/buscar?local=Uberl%C3%A2ndia${estado.query}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const mais = page.getByTestId("pilula-mais").first();
      await expect(mais).toBeVisible({ timeout: 30_000 });
      // O contador vem da URL lida no cliente: espera o rótulo do estado.
      await expect.poll(async () => (await mais.innerText()).replace(/\s+/g, " ").trim(), { timeout: 30_000 }).toMatch(estado.rotulo);

      await dentroDaTela(page, "pilula-mais", largura);
      await dentroDaTela(page, "pilula-ordenar", largura);
      await dentroDaTela(page, "pilula-mapa", largura);

      const lateral = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(lateral, `/buscar rola ${lateral} px de lado a ${largura} px`).toBeLessThanOrEqual(0);
    });
  }

  test(`T2060 — E733: a ${largura} px o anúncio diz Ver o caminho para morar @E733 @ao-vivo-seguro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura >= 1024 ? 900 : 800 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByText("Ver o caminho para morar").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Ver o caminho de reserva")).toHaveCount(0);
  });
}
