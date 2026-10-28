import { test, expect, type Page } from "@playwright/test";

/*
  T595 — E84: a Central de Ajuda nos mockups aprovados (ajuda-central, pagina-fale-com-a-viva, ajuda-termos,
  ajuda-privacidade). Cada destino com página própria; a promessa "em até 24 h" uma vez por página (antes, 4× na /ajuda).
   1. /ajuda: foto no topo, cartão "Fale com a Viva", 4 cartões de tema que filtram as perguntas, documentos; sem chat
      nem formulário de chamado; largura da página (não a coluna estreita de antes).
   2. /ajuda/fale-com-a-viva: o chat e o chamado; links antigos (/ajuda?novo=1) chegam aqui.
   3. /termos e /privacidade: páginas próprias com índice e "Ficou alguma dúvida? Fale com a Viva."
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(p: Page) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
const vezes = async (p: Page, trecho: string) => ((await p.locator("body").innerText()).split(trecho).length - 1);

for (const largura of [390, 1280] as const) {
  test.describe(`T595 — E84 a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("1. hub: foto, Fale com a Viva, 4 temas que filtram, documentos; a promessa uma vez", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Central de ajuda", { timeout: 30_000 });
      await expect(page.getByTestId("banner-topo")).toBeVisible();
      await expect(page.getByTestId("ajuda-cartao-fale")).toBeVisible();
      await expect(page.getByTestId("ajuda-ir-fale")).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
      for (const t of ["morador", "proprietarios", "contratos", "seguranca"]) await expect(page.getByTestId(`ajuda-tema-${t}`)).toBeVisible();
      await expect(page.getByTestId("viva-chat-bloco")).toHaveCount(0);
      await expect(page.getByTestId("atendimento-abrir")).toHaveCount(0);
      await expect(page.getByTestId("ajuda-doc-termos")).toHaveAttribute("href", "/termos");
      await expect(page.getByTestId("ajuda-doc-privacidade")).toHaveAttribute("href", "/privacidade");
      await expect(page.getByTestId("ajuda-perguntas")).toBeVisible();
      expect(await vezes(page, "em até 24 h")).toBe(1);
      if (largura === 1280) {
        // Página inteira, não a coluna de 768 px de antes.
        const caixa = await page.getByTestId("ajuda-perguntas").boundingBox();
        expect(caixa!.width).toBeGreaterThan(900);
      }
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t595-hub-${largura}.png`, fullPage: true });

      await page.getByTestId("ajuda-tema-contratos").click();
      await expect(page).toHaveURL(/\/ajuda\?tema=contratos#perguntas$/);
      const perguntas = page.getByTestId("ajuda-perguntas");
      await expect(perguntas.getByRole("heading", { level: 2 })).toHaveText("Contratos e pagamentos");
      await expect(perguntas.locator("li button")).toHaveText(["Como funciona a caução?", "Posso renovar o contrato?", "Algo quebrou no imóvel. O que eu faço?", "Qual o prazo mínimo e máximo da locação?"]);
      await expect(page.getByTestId("ajuda-tema-contratos")).toHaveAttribute("aria-current", "true");
      await expect(page.getByTestId("ajuda-todas")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t595-hub-tema-${largura}.png`, fullPage: false });
    });

    test("2. Fale com a Viva: página própria com o chat e o chamado; /ajuda?novo=1 chega aqui", async ({ page }) => {
      await page.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fale com a Viva", { timeout: 30_000 });
      await expect(page.getByTestId("viva-chat-bloco")).toBeVisible();
      await expect(page.getByTestId("atendimento-abrir")).toBeVisible();
      await expect(page.getByTestId("fale-ir-central")).toHaveAttribute("href", "/ajuda");
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
      expect(await vezes(page, "em até 24 h")).toBe(1);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t595-fale-${largura}.png`, fullPage: true });

      await page.goto("/ajuda?novo=1", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/ajuda\/fale-com-a-viva\?novo=1$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Abrir chamado" })).toBeVisible({ timeout: 30_000 });
    });

    for (const [rota, titulo, secoes, trecho] of [
      ["/termos", "Termos de Uso", 8, "não é locador, fiador, garantidor nem parte do contrato"],
      ["/privacidade", "Política de Privacidade", 11, "Suboperadores (com quem compartilhamos seus dados)"],
    ] as const) {
      test(`3. ${rota}: página própria com índice e 'Ficou alguma dúvida?'`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo, { timeout: 30_000 });
        await expect(page.locator("[data-legal-corpo]")).toContainText(trecho);
        const indice = page.getByTestId("indice-legal");
        if (largura === 390) await indice.locator("summary").click();
        const itens = indice.locator("a:visible");
        await expect(itens).toHaveCount(secoes, { timeout: 20_000 });
        await itens.nth(2).click();
        await expect(page).toHaveURL(new RegExp(`${rota}#secao-3$`));
        await expect(page.getByTestId("legal-duvida").getByRole("link", { name: "Falar com a Viva" })).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
        await semRolagemLateral(page);
        await page.screenshot({ path: `${SAIDA}/t595${rota.replace("/", "-")}-${largura}.png`, fullPage: false });
      });
    }
  });
}
