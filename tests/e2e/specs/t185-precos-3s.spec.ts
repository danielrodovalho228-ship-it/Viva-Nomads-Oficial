import { test, expect, type Page } from "@playwright/test";

/*
  T185 — /precos revisão 3S (prompt 13), a 390, 768 e 1280 px.
  1. "Anunciar meu imóvel" (primário) e "Falar sobre o Plano Gestor" (secundário) sem se cruzar, ≥ 12 px entre eles.
  2. O formulário do Plano Gestor abre numa janela à parte e fecha (Esc e botão).
  3. Nenhuma grade de caixas com número ímpar.
  4. Sem "inquilino", "locação", "aluguel" nem "comissão" no texto da página.
  5. Faixas de taxa no celular em cartões, sem rolagem lateral.
  6. Todo percentual de concorrente com link de fonte; QuintoAndar fora; Booking.com sem número.
*/
const SAIDA = "tests/laboratorio/saida";

async function caixas(page: Page) {
  const anunciar = page.getByTestId("precos-botoes").getByRole("link", { name: "Anunciar meu imóvel" });
  const gestor = page.getByTestId("plano-gestor-botao");
  await anunciar.scrollIntoViewIfNeeded();
  return [(await anunciar.boundingBox())!, (await gestor.boundingBox())!];
}

for (const largura of [390, 768, 1280]) {
  test(`T185 ${largura}px — botões sem sobreposição, grades pares, vocabulário e fontes`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/precos", { waitUntil: "domcontentloaded" });

    const [a, g] = await caixas(page);
    const cruzam = a.x < g.x + g.width && g.x < a.x + a.width && a.y < g.y + g.height && g.y < a.y + a.height;
    expect(cruzam, "botões se cruzam").toBe(false);
    const distancia = Math.max(g.x - (a.x + a.width), a.x - (g.x + g.width), g.y - (a.y + a.height), a.y - (g.y + g.height));
    expect(distancia).toBeGreaterThanOrEqual(12);
    await page.screenshot({ path: `${SAIDA}/t185-botoes-${largura}.png`, fullPage: false });

    for (const id of ["precos-destaques", "comparativo-linhas", "precos-incluido", "precos-opcionais"]) {
      const grade = id === "precos-incluido" || id === "precos-opcionais" ? page.getByTestId(id).locator(".grid, ul.grid").first() : page.getByTestId(id);
      const n = await grade.locator(":scope > *").count();
      expect(n % 2, `${id} com ${n} caixas`).toBe(0);
    }

    const texto = await page.locator("main").innerText();
    expect(texto).not.toMatch(/inquilin|loca[çc][ãa]o|aluguel|comiss[ãa]o/i);
    expect(texto).not.toMatch(/QuintoAndar/);

    const compare = page.getByTestId("comparativo-linhas");
    for (const li of await compare.locator(":scope > li").all()) {
      const numero = (await li.getByTestId("compare-numero").innerText()).trim();
      const id = await li.getAttribute("data-compare");
      if (/%/.test(numero) && id !== "viva") await expect(li.getByTestId("compare-fonte").locator("a")).toHaveAttribute("href", /^https:\/\//);
    }
    await expect(compare.locator('[data-compare="booking"]').getByTestId("compare-numero")).toHaveText("Varia por contrato");

    if (largura === 390) {
      await expect(page.getByTestId("faixas-taxa-cartoes")).toBeVisible();
      await expect(page.getByTestId("faixas-taxa")).toBeHidden();
    } else {
      await expect(page.getByTestId("faixas-taxa")).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t185-precos-${largura}.png`, fullPage: true });
  });
}

test("T185 — Plano Gestor abre numa janela à parte e fecha (390 e 1280)", async ({ page }) => {
  for (const largura of [390, 1280]) {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/precos", { waitUntil: "domcontentloaded" });
    const regra = page.getByTestId("regra-unica");
    const alturaAntes = (await regra.boundingBox())!.height;
    await page.getByTestId("plano-gestor-botao").click();
    const janela = page.getByRole("dialog", { name: /Plano Gestor/ });
    await expect(janela).toBeVisible();
    await expect(janela.getByTestId("plano-gestor-form")).toBeVisible();
    // O formulário não se expande no meio da tabela.
    expect((await regra.boundingBox())!.height).toBeCloseTo(alturaAntes, 0);
    await page.screenshot({ path: `${SAIDA}/t185-plano-gestor-${largura}.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await expect(janela).toHaveCount(0);
    await page.getByTestId("plano-gestor-botao").click();
    await janela.getByRole("button", { name: "Fechar" }).click();
    await expect(janela).toHaveCount(0);
  }
});

test("T185 — 390px: o 'Fale com a Viva' não tampa os botões nem as faixas da tabela (mesma regra do Q4)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/precos", { waitUntil: "networkidle" });
  const flut = page.getByTestId("fale-com-a-viva");
  await expect(flut).toBeVisible();
  const alvos = [page.getByTestId("precos-botoes"), ...(await page.getByTestId("faixas-taxa-cartoes").locator(":scope > li").all())];
  for (const alvo of alvos) {
    await alvo.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(150);
    const a = (await alvo.boundingBox())!;
    const f = (await flut.boundingBox())!;
    const cruza = a.x < f.x + f.width && f.x < a.x + a.width && a.y < f.y + f.height && f.y < a.y + a.height;
    expect(cruza, `flutuante tampa ${await alvo.getAttribute("data-testid") ?? "uma faixa"}`).toBe(false);
  }
  await page.getByTestId("precos-botoes").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.screenshot({ path: `${SAIDA}/t185-flutuante-390.png`, fullPage: false });
});
