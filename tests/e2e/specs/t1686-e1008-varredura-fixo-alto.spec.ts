import { test, expect, type Page } from "@playwright/test";
import { controlesCobertos } from "../fixtures/varredura";

/*
  T1686 — E1008: a régua "fixo" da varredura (controlesCobertos) só acusa o controle que a rolagem NÃO revela.
  A t407 ("Buscar com o km até o local digitado", 390 px) acusava o cartão do anúncio como "coberto por elemento fixo
  mesmo depois de rolar até ele". A régua rolava o cartão até o MEIO da tela e media os cantos. Na Busca a 390 px a
  barra de filtros fixa vai até 312 px (desenho decidido no E946); os cantos de cima de um cartão de 402 px centrado
  ficam debaixo dela. Mas rolar mais um pouco mostra o cartão inteiro: não é conteúdo escondido.
  A régua passa a tentar três posições (meio, fim e começo da tela) e só acusa o ponto do controle que fica debaixo de
  um fixo em todas elas.

  Página sintética, sem servidor e sem conta: o teste prova as duas metades da regra.
    1. Cartão alto, faixa fixa alta no topo e barra fixa embaixo: rolar revela o cartão → nenhum achado.
    2. A régua não afrouxou: o que a rolagem não revela continua acusado — uma camada fixa por cima da tela, um botão no
       fim da página debaixo da barra de baixo e um botão no começo da página debaixo da faixa de cima.
*/
const PAGINA = (corpo: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{margin:0;font:14px/20px Arial,sans-serif}
  .faixa{position:sticky;top:0;height:312px;background:#fff;border-bottom:1px solid #ddd;z-index:10}
  .barra{position:fixed;left:0;right:0;bottom:0;height:54px;background:#fff;border-top:1px solid #ddd;z-index:10}
  .cartao{display:flex;flex-direction:column;height:402px;margin:0 20px;background:#e7d7c1;color:#111;text-decoration:none}
</style></head><body>${corpo}</body></html>`;

/** A Busca a 390 px: faixa de filtros fixa até 312 px, barra de abas fixa embaixo, cartões de 402 px. */
const BUSCA = (folga: number) => `
  <div class="faixa"><button type="button">Datas</button><button type="button">Mais filtros</button><button type="button" id="mapa">Mapa</button></div>
  <div style="height:${folga}px"></div>
  <a class="cartao" id="cartao" href="#anuncio">Centro, Uberlândia - MG · Novo na plataforma</a>
  <div style="height:1600px"></div>
  <nav class="barra"><a href="#inicio">Início</a> <a href="#buscar">Buscar</a></nav>`;

/** O que a medida antiga via: com o controle no meio da tela, o canto de cima dele está debaixo de quê? */
async function cantoDeCimaNoMeio(page: Page, id: string): Promise<string> {
  return page.evaluate((i) => {
    const el = document.getElementById(i)!;
    const salvo = window.scrollY;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width * 0.15, r.top + r.height * 0.15);
    window.scrollTo({ top: salvo, behavior: "instant" });
    return t?.closest(".faixa") ? "faixa fixa" : t === el || el.contains(t) ? "o próprio controle" : (t?.tagName ?? "nada");
  }, id);
}

test.describe("T1686 — E1008: a varredura só acusa o que a rolagem não revela", () => {
  for (const altura of [844, 760] as const) {
    test(`a 390 × ${altura}: cartão alto sob faixa fixa alta, que rolar revela, não é acusado`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: altura });
      // Com a página no topo, o centro do cartão fica debaixo da barra de baixo: é o que faz a régua conferir o cartão.
      const folga = altura - 54 + 8 - 201 - 312;
      await page.setContent(PAGINA(BUSCA(folga)));
      const centro = await page.evaluate(() => {
        const r = document.getElementById("cartao")!.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".barra") ? "barra de baixo" : "livre";
      });
      expect(centro, "com a página no topo, o centro do cartão está debaixo da barra de baixo").toBe("barra de baixo");
      // A situação da t407: no meio da tela, o canto de cima do cartão fica debaixo da faixa fixa.
      expect(await cantoDeCimaNoMeio(page, "cartao"), "com o cartão no meio da tela, o canto de cima dele").toBe("faixa fixa");

      expect(await controlesCobertos(page)).toEqual([]);
    });
  }

  test("o que a rolagem não revela continua acusado: camada fixa por cima da tela", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(
      PAGINA(`
        <div style="height:300px"></div>
        <button type="button" id="alvo">Publicar anúncio</button>
        <div style="height:1600px"></div>
        <div id="camada" style="position:fixed;inset:0;z-index:20">camada por cima</div>`),
    );
    const achados = await controlesCobertos(page);
    expect(achados.filter((a) => a.startsWith("topo: "))).toEqual(['topo: "Publicar anúncio" coberto por elemento fixo mesmo depois de rolar até ele (div "camada por cima")']);
  });

  test("o que a rolagem não revela continua acusado: botão no fim da página, debaixo da barra de baixo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(
      PAGINA(`
        <div style="height:1600px"></div>
        <button type="button" id="alvo" style="display:block;width:200px;height:40px">Salvar alterações</button>
        <nav class="barra"><a href="#inicio">Início</a></nav>`),
    );
    const achados = await controlesCobertos(page);
    expect(achados.filter((a) => a.startsWith("fim: "))).toEqual(['fim: "Salvar alterações" coberto por elemento fixo mesmo depois de rolar até ele (nav "Início")']);
  });

  test("o que a rolagem não revela continua acusado: botão no começo da página, debaixo da faixa de cima", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(
      PAGINA(`
        <div id="topo-fixo" style="position:fixed;top:0;left:0;right:0;height:312px;background:#fff;z-index:10">faixa de cima</div>
        <div style="height:120px"></div>
        <button type="button" id="alvo" style="display:block;width:200px;height:40px">Abrir o mapa</button>
        <div style="height:1600px"></div>`),
    );
    const achados = await controlesCobertos(page);
    expect(achados.filter((a) => a.startsWith("topo: "))).toEqual(['topo: "Abrir o mapa" coberto por elemento fixo mesmo depois de rolar até ele (div "faixa de cima")']);
  });
});
