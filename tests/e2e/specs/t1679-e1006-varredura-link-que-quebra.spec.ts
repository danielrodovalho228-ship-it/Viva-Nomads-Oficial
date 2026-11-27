import { test, expect, type Page } from "@playwright/test";
import { controlesCobertos } from "../fixtures/varredura";

/*
  T1679 — E1006: a régua "fixo" da varredura (controlesCobertos) mede o link em linha pela 1ª caixa de linha.
  A t622 ("Meus imóveis com só um rascunho", 390 px) acusava "Preço mensal" coberto pelo link vizinho de "Falta para
  publicar". Esses links são texto corrido dentro de um parágrafo; não se cobrem. O achado vinha da medida: num link
  que quebra de linha, a caixa do elemento é a união das linhas, e o centro dela cai em cima do vizinho.

  Página sintética, sem servidor e sem conta: o teste prova as duas metades da regra.
    1. Links em linha que quebram de linha, um ao lado do outro: nenhum achado.
    2. A régua não afrouxou: o que cobre de verdade um controle continua acusado — num botão comum e na 1ª linha de um
       link que quebra.
*/
const PAGINA = (corpo: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:16px;font:14px/20px Arial,sans-serif} a{color:#065f46;text-decoration:underline} .tampa{position:absolute;background:#fde68a}</style></head><body>${corpo}</body></html>`;

/**
 * O parágrafo de "Falta para publicar" de Meus imóveis: os atalhos são links em linha, separados por " · ". Linhas
 * encostadas uma na outra, como na tela (lá: 11 px com entrelinha de 16,5 px): é o que faz o centro da caixa de um link
 * de duas linhas cair dentro da linha de baixo.
 */
const FALTA_PARA_PUBLICAR = `<p id="falta" style="width:330px;font:14px/16px Arial,sans-serif">Falta para publicar:
  <a href="#fotos">Pelo menos 8 fotos</a> · <a href="#preco" id="preco">Preço mensal</a> ·
  <a href="#documento" id="documento">Documento do imóvel aprovado (ainda não enviado para análise)</a> ·
  <a href="#entrada" id="entrada">Tipo de entrada (porteiro, chave, cofre ou fechadura com código)</a> ·
  <a href="#internet" id="internet">Velocidade da internet (em Mbps, no bloco de trabalho)</a></p>`;

async function linhasDe(page: Page, id: string): Promise<number> {
  return page.locator(`#${id}`).evaluate((el) => el.getClientRects().length);
}

test.describe("T1679 — E1006: a varredura mede o link que quebra de linha pela 1ª linha", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("links em linha que quebram de linha, lado a lado, não são acusados", async ({ page }) => {
    await page.setContent(PAGINA(FALTA_PARA_PUBLICAR));
    // Monta a situação da t622: estreita o parágrafo até um link quebrar de linha de modo que o centro da caixa inteira
    // dele caia em cima do link vizinho (o ponto que a medida antiga usava). A largura exata depende da fonte do navegador.
    const largura = await page.evaluate(() => {
      const p = document.getElementById("falta")!;
      for (let w = 340; w >= 180; w -= 2) {
        p.style.width = `${w}px`;
        const caiNoVizinho = Array.from(p.querySelectorAll<HTMLElement>("a")).some((el) => {
          if (el.getClientRects().length < 2) return false;
          const r = el.getBoundingClientRect();
          const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!t && t !== el && t.tagName === "A";
        });
        if (caiNoVizinho) return w;
      }
      return 0;
    });
    expect(largura, "largura em que o centro da caixa inteira de um link que quebra cai em cima do link vizinho").toBeGreaterThan(0);

    expect(await controlesCobertos(page)).toEqual([]);
  });

  test("o que cobre de verdade continua acusado: botão comum e a 1ª linha de um link que quebra", async ({ page }) => {
    await page.setContent(
      PAGINA(`
        <div style="position:relative;display:inline-block"><button id="alvo" type="button">Publicar anúncio</button><div class="tampa" style="inset:0">tampa do botão</div></div>
        <div style="position:relative;margin-top:24px">${FALTA_PARA_PUBLICAR}<div class="tampa" id="tampa-linha">tampa da linha</div></div>`),
    );
    expect(await linhasDe(page, "documento")).toBeGreaterThan(1);
    // A tampa fica só sobre a 1ª linha do link comprido (a caixa que a régua mede).
    await page.evaluate(() => {
      const pai = document.getElementById("tampa-linha")!.parentElement!.getBoundingClientRect();
      const linha = document.getElementById("documento")!.getClientRects()[0];
      const tampa = document.getElementById("tampa-linha")!;
      Object.assign(tampa.style, { left: `${linha.left - pai.left}px`, top: `${linha.top - pai.top}px`, width: `${linha.width}px`, height: `${linha.height}px`, overflow: "hidden" });
    });

    const achados = await controlesCobertos(page);
    expect(achados.filter((a) => a.startsWith("topo: ")), "achados com a página no topo").toEqual([
      'topo: "Publicar anúncio" coberto por div "tampa do botão"',
      'topo: "Documento do imóvel aprovado (ainda não " coberto por div "tampa da linha"',
    ]);
  });
});
