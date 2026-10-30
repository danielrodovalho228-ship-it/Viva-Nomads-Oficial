import { test, expect, type Page } from "@playwright/test";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T709 — conformidade visual da CENTRAL DE AJUDA (passada final, 30/10), a 1280 e 390: o título do banner começa na
  mesma coluna do conteúdo de baixo (antes, a 1280, o "Central de ajuda" ficava na borda da página, x=40, e o conteúdo
  numa coluna centrada, x=128); o mesmo na "Fale com a Viva". E a varredura do protocolo (seis classes) limpa.
*/
const SAIDA = "tests/laboratorio/saida";
const esquerda = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().left));

const PAGINAS = [
  { nome: "hub", rota: "/ajuda", conteudo: '[data-testid="ajuda-cartao-fale"]' },
  { nome: "fale", rota: "/ajuda/fale-com-a-viva", conteudo: '[data-testid="fale-com-a-viva"] > .container-page > div' },
] as const;

test.describe("T709 — conformidade da Central de ajuda", () => {
  for (const pg of PAGINAS)
    for (const largura of [1280, 390] as const) {
      test(`${pg.nome} ${largura} px: título na coluna do conteúdo; varredura limpa`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const p = await ctx.newPage();
        const respostas = escutarImagens(p);
        await p.goto(pg.rota, { waitUntil: "domcontentloaded" });
        await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const titulo = await esquerda(p, '[data-testid="banner-topo"] h1');
        const conteudo = await esquerda(p, pg.conteudo);
        expect(titulo, `o título (x=${titulo}) começa na coluna do conteúdo (x=${conteudo})`).toBe(conteudo);
        await p.screenshot({ path: `${SAIDA}/t709-${pg.nome}-${largura}.png` });
        if (pg.nome === "hub") {
          const achados = await varrerPagina(p, respostas);
          for (const c of Object.keys(CLASSES) as Classe[]) expect.soft(achados[c], `ajuda ${largura} — ${CLASSES[c]}`).toEqual([]);
        }
        await ctx.close();
      });
    }
});
