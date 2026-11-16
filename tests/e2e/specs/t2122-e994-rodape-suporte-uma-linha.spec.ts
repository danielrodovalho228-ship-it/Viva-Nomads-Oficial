import { test, expect, type Page } from "@playwright/test";

/*
  T2122 — E994 (Code 2, julgamento do Gerente 16/11/2026) @E994 @ao-vivo-seguro (só lê páginas públicas).
  A 1280 px, com a faixa do flutuante, a primeira coluna do rodapé fica com ~264 px e a frase
  "Suporte: suporte@vivanomads.com.br" tem ~261 px: cabia por 3 px e quebrava em duas linhas no navegador do GitHub
  (fontes um pouco mais largas). Regra: a partir de 1280 px a linha não quebra; abaixo disso (a coluna tem ~144–210 px)
  ela continua quebrando dentro da coluna, sem vazar.
  A prova encolhe a coluna para 250 px (o que o navegador do GitHub "vê") e mede a altura da linha.
*/

const linhaSuporte = (p: Page) => p.locator("footer p", { hasText: "Suporte:" });

async function linhas(p: Page) {
  return linhaSuporte(p).evaluate((el) => {
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    return Math.round(el.getBoundingClientRect().height / lh);
  });
}

test.describe("T2122 — E994: a linha 'Suporte' do rodapé não quebra a 1280 px @E994 @ao-vivo-seguro", () => {
  test("1280 px: com a coluna em 250 px a linha continua em uma linha só", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/favoritos", { waitUntil: "networkidle" });
    await expect(linhaSuporte(page)).toBeVisible();
    await linhaSuporte(page).evaluate((el) => {
      (el.parentElement as HTMLElement).style.width = "250px";
    });
    expect(await linhas(page)).toBe(1);
  });

  test("1024 px: a coluna é estreita e a linha quebra dentro dela, sem vazar", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/favoritos", { waitUntil: "networkidle" });
    await expect(linhaSuporte(page)).toBeVisible();
    const vaza = await linhaSuporte(page).evaluate((el) => el.scrollWidth > (el.parentElement as HTMLElement).clientWidth + 1);
    expect(vaza).toBe(false);
  });
});
