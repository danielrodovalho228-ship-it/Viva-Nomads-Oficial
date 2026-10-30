import { test, expect, type Page } from "@playwright/test";

// Regressão dos merges #1472–#1479 (Pista C, 29/10): a suíte completa estoura o tempo antes de chegar aqui; roda no portão do PR.
/*
  T598 — E84: a Central de Ajuda nos mockups aprovados (ajuda-central, pagina-fale-com-a-viva, ajuda-termos,
  ajuda-privacidade). Cada destino com página própria; a promessa "em até 24 h" uma vez por página (antes, 4× na /ajuda).
   1. /ajuda: foto no topo, cartão "Fale com a Viva", 4 cartões de tema COM FOTO que levam à página própria do tema
      (/ajuda/<tema>, com as suas perguntas), documentos; o hub não lista perguntas (QA de 29/10); sem chat nem chamado.
   2. /ajuda/fale-com-a-viva: o chat e o chamado; links antigos (/ajuda?novo=1) chegam aqui.
   3. /termos e /privacidade: páginas próprias com índice e "Ficou alguma dúvida? Fale com a Viva."
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(p: Page) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
// A página inteira, com o rodapé: a promessa aparece uma vez só (o rodapé não repete a frase — E84, ajuste de 29/10).
const vezes = async (p: Page, trecho: string) => ((await p.locator("body").innerText()).split(trecho).length - 1);

for (const largura of [390, 1280] as const) {
  test.describe(`T598 — E84 a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("1. hub limpo: foto, Fale com a Viva, 4 temas com foto que levam à página própria; nenhuma pergunta no hub", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Central de ajuda", { timeout: 30_000 });
      await expect(page.getByTestId("banner-topo")).toBeVisible();
      await expect(page.getByTestId("ajuda-cartao-fale")).toBeVisible();
      await expect(page.getByTestId("ajuda-ir-fale")).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
      for (const t of ["morador", "proprietarios", "contratos", "seguranca"]) {
        const cartao = page.getByTestId(`ajuda-tema-${t}`);
        await expect(cartao).toHaveAttribute("href", `/ajuda/${t}`);
        // Todo cartão de tema com foto (o 4º antes era só o ícone).
        await expect(cartao.locator("img")).toHaveCount(1);
      }
      // Hub limpo: nenhuma pergunta despejada, nenhum título em inglês.
      await expect(page.getByTestId("ajuda-perguntas")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(/Frequently|Questions/);
      await expect(page.getByTestId("viva-chat-bloco")).toHaveCount(0);
      await expect(page.getByTestId("atendimento-abrir")).toHaveCount(0);
      await expect(page.getByTestId("ajuda-doc-termos")).toHaveAttribute("href", "/termos");
      await expect(page.getByTestId("ajuda-doc-privacidade")).toHaveAttribute("href", "/privacidade");
      expect(await vezes(page, "em até 24 h")).toBe(1);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t598-hub-${largura}.png`, fullPage: true });

      // Cada tema na sua página, com as suas perguntas (em português).
      await page.getByTestId("ajuda-tema-contratos").click();
      await expect(page).toHaveURL(/\/ajuda\/contratos$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contratos e pagamentos");
      const perguntas = page.getByTestId("ajuda-perguntas");
      await expect(perguntas.getByRole("heading", { level: 2 })).toHaveText("Perguntas deste tema");
      await expect(perguntas.locator("li button")).toHaveText(["Como funciona a caução?", "Posso renovar o contrato?", "Algo quebrou no imóvel. O que eu faço?", "Qual o prazo mínimo e máximo da locação?"]);
      await expect(page.getByTestId("ajuda-voltar-central")).toHaveAttribute("href", "/ajuda");
      if (largura === 1280) {
        const caixa = await perguntas.boundingBox();
        expect(caixa!.width).toBeGreaterThan(900);
      }
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t598-tema-${largura}.png`, fullPage: true });

      // Link antigo (/ajuda?tema=x) chega à página do tema.
      await page.goto("/ajuda?tema=seguranca", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/ajuda\/seguranca$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Segurança e conta");
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
      await page.screenshot({ path: `${SAIDA}/t598-fale-${largura}.png`, fullPage: true });

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
        await page.screenshot({ path: `${SAIDA}/t598${rota.replace("/", "-")}-${largura}.png`, fullPage: false });
      });
    }
  });
}
