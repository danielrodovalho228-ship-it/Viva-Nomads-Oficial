import { test, expect, type Page } from "@playwright/test";

/*
  T1663 — E949: "Pular para o conteúdo principal" leva ao conteúdo, visível, abaixo do cabeçalho fixo.
  Antes, o topo do <main> encostava no topo da janela e os primeiros 73 px ficavam atrás do cabeçalho preso (na home,
  o título inteiro); o foco não saía do <body>.
  Para cada página pública, a 390 e a 1280 px, pelo teclado:
   • o link aparece ao receber o foco e, com Enter, a página vai para #conteudo;
   • o conteúdo começa abaixo do cabeçalho (nada coberto) e o primeiro título está à vista;
   • o foco está no <main>, e o Tab seguinte cai dentro do conteúdo (o menu foi mesmo pulado).
*/
const PAGINAS = ["/parceiros", "/", "/ajuda", "/como-funciona", "/para-proprietarios", "/buscar"];
const LARGURAS = [
  { largura: 390, altura: 844 },
  { largura: 1280, altura: 900 },
] as const;

/** Onde termina o cabeçalho preso e onde começam o <main> e o primeiro título, em px da janela. */
const medir = (page: Page) =>
  page.evaluate(() => {
    const main = document.getElementById("conteudo")!;
    const topo = document.querySelector('[data-testid="topo-publico"]')!.getBoundingClientRect();
    const titulo = [...main.querySelectorAll("h1, h2")].find((e) => (e as HTMLElement).offsetParent !== null);
    return {
      fundoDoCabecalho: topo.bottom,
      cabecalhoPreso: topo.top <= 0.5,
      topoDoConteudo: main.getBoundingClientRect().top,
      topoDoTitulo: titulo ? titulo.getBoundingClientRect().top : null,
      focoNoMain: document.activeElement === main,
    };
  });

for (const { largura, altura } of LARGURAS) {
  test.describe(`T1663 — E949: skip-link a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    for (const rota of PAGINAS) {
      test(`${rota}: o conteúdo aparece abaixo do cabeçalho e recebe o foco`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "load" });
        const link = page.locator("a.skip-link");
        await link.focus();
        await expect(link, "o link aparece ao receber o foco").toBeInViewport();
        await page.keyboard.press("Enter");
        await expect.poll(() => new URL(page.url()).hash).toBe("#conteudo");
        // A rolagem assenta (o cabeçalho fica preso no topo quando a faixa de cima sai).
        await expect.poll(async () => (await medir(page)).cabecalhoPreso, { timeout: 5_000 }).toBe(true);
        const m = await medir(page);
        expect(m.topoDoConteudo, `o conteúdo começa abaixo do cabeçalho (cabeçalho termina em ${m.fundoDoCabecalho} px)`).toBeGreaterThanOrEqual(m.fundoDoCabecalho - 0.5);
        expect(m.topoDoTitulo, "há um título no conteúdo").not.toBeNull();
        expect(m.topoDoTitulo!, "o primeiro título não fica atrás do cabeçalho").toBeGreaterThanOrEqual(m.fundoDoCabecalho);
        expect(m.topoDoTitulo!, "o primeiro título está na primeira tela").toBeLessThan(altura);
        expect(m.focoNoMain, "o foco está no <main>").toBe(true);
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(() => document.getElementById("conteudo")!.contains(document.activeElement) && document.activeElement !== document.getElementById("conteudo")),
          "o Tab seguinte cai num controle de dentro do conteúdo",
        ).toBe(true);
      });
    }
  });
}
