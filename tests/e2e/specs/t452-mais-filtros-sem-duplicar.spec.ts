import { test, expect, type Page } from "@playwright/test";

/**
 * T452 — E105 (regra E50, cada conteúdo num lugar só), no print do Daniel no celular:
 *  1. As pílulas de cima são os filtros rápidos (Datas, Local, Tipo, Preço, Nível); o "Mais filtros" fica SÓ com o que
 *     não tem pílula — sem "Preço por mês", "Tipo de imóvel", "Nível a partir de" nem a data de entrada; e a pílula
 *     "Datas" sem o período da estadia (que mora na seção "Estadia" do "Mais filtros").
 *  2. Nenhuma opção de filtro se perdeu: preço, tipo e nível seguem nas pílulas, com a contagem.
 *  3. "Limpar tudo" é um BOTÃO de contorno, ao lado do "Mostrar N imóveis", e zera o rascunho.
 *  Em 390 e 1280 px, com prints.
 */
const SAIDA = "tests/laboratorio/saida";
const FORA_DA_FOLHA = ["Preço por mês", "Tipo de imóvel", "Nível a partir de", "Entrada em"];
const NA_FOLHA = ["Quartos", "Estadia", "Do seu jeito", "Contrato", "Comodidades"];

async function abrirFolha(page: Page, url: string) {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return page.getByTestId("painel-filtros");
}

for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test.describe(`T452 — "Mais filtros" sem duplicar as pílulas, a ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: largura, height: altura });
    });

    test("1 e 3. a folha só com o que não tem pílula; 'Limpar tudo' é botão ao lado do 'Mostrar N'", async ({ page }) => {
      // Com uma data na URL: antes, a folha repetia a entrada ("Entrada em …") e a flexibilidade.
      const folha = await abrirFolha(page, "/buscar?local=Uberl%C3%A2ndia&entrada=2026-12-01");
      for (const t of NA_FOLHA) await expect(folha.getByText(t, { exact: true }).first(), t).toBeVisible();
      for (const t of FORA_DA_FOLHA) await expect(folha.getByText(t), t).toHaveCount(0);
      for (const id of ["faceta-preco-2500", "faceta-tipo-apartamento", "filtro-nivel-conforto", "painel-tipo", "painel-nivel", "painel-datas"]) {
        await expect(folha.getByTestId(id), id).toHaveCount(0);
      }

      const limpar = folha.getByTestId("limpar-tudo");
      const mostrar = folha.getByTestId("aplicar-filtros");
      await expect(limpar).toHaveText("Limpar tudo");
      // Botão de contorno: borda, fundo branco, sem sublinhado e da altura do "Mostrar N".
      expect(await limpar.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("solid");
      expect(await limpar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await limpar.evaluate((el) => getComputedStyle(el).textDecorationLine)).not.toContain("underline");
      const l = (await limpar.boundingBox())!;
      const m = (await mostrar.boundingBox())!;
      expect(Math.abs(l.height - m.height), "mesma altura do primário").toBeLessThanOrEqual(2);
      expect(Math.abs(l.y + l.height / 2 - (m.y + m.height / 2)), "na mesma linha").toBeLessThanOrEqual(2);
      expect(l.x + l.width, "à esquerda do Mostrar N").toBeLessThanOrEqual(m.x + 1);
      expect(m.x - (l.x + l.width), "lado a lado").toBeLessThanOrEqual(24);
      await page.screenshot({ path: `${SAIDA}/t452-mais-filtros-${largura}.png`, fullPage: false });

      // Zera o rascunho: escolher Quartos e limpar volta o "Mostrar N" ao total.
      const total = Number(await mostrar.getAttribute("data-total"));
      // Uma faceta com imóvel (as de contagem 0 ficam desabilitadas).
      await folha.locator('button[data-testid^="faceta-"]:not([disabled])').first().click();
      await limpar.click();
      await expect(mostrar).toHaveAttribute("data-total", String(total));
    });

    test("2. preço, tipo e nível seguem nas pílulas (com contagem); a pílula Datas sem o período da estadia", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
      const casos = [
        ["pilula-preco", "painel-pilula-preco", "pilula-preco-3500"],
        ["pilula-tipo", "painel-pilula-tipo", "pilula-tipo-apartamento"],
        ["pilula-nivel", "painel-pilula-nivel", null],
      ] as const;
      for (const [pilula, painel, opcao] of casos) {
        await expect(async () => {
          await page.getByTestId(pilula).click({ timeout: 5_000 });
          await expect(page.getByTestId(painel)).toBeVisible({ timeout: 5_000 });
        }).toPass({ timeout: 60_000 });
        if (opcao) await expect(page.getByTestId(opcao)).toHaveAttribute("data-n", /^\d+$/);
        else await expect(page.getByTestId(painel).locator('[data-testid^="pilula-nivel-"], [data-testid="painel-nivel-vazio"]').first()).toBeVisible();
        await page.screenshot({ path: `${SAIDA}/t452-${pilula}-${largura}.png`, fullPage: false });
        await page.keyboard.press("Escape");
        await expect(page.getByTestId(painel)).toHaveCount(0);
      }
      await page.getByTestId("pilula-datas").click();
      const datas = page.getByTestId("painel-pilula-datas");
      await expect(datas.getByTestId("pilula-datas-entrada")).toBeVisible();
      await expect(datas).not.toContainText("Período da estadia");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}
