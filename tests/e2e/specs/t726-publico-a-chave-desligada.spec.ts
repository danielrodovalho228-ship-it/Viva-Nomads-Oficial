import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T726 — PUBLICO-A parte 1 (#1637), o lado DESLIGADO da chave NEXT_PUBLIC_SELETOR_IDIOMA (o padrão): o topo público fica
  idêntico ao de antes do merge, a 1280 e 390, sem globo e sem mudança de layout. A t742 (Pista A) confere os destinos e
  a ausência do globo na home; esta confere a estrutura e a geometria, em quatro páginas públicas. Pista C, bloco 80.
   1280: em "nav-acoes" só existem "Fale com a Viva" e "Entrar", nessa ordem, a 16 px um do outro (gap-4) e o Entrar
         encostado na margem direita do topo; o topo tem a mesma altura (h-18 = 72 px) nas quatro páginas; nenhum
         seletor-idioma no DOM, nenhum "PT"/"EN" no topo; sem rolagem lateral.
   390:  o menu aberto lista exatamente Imóveis · Anunciar · Empresas · Fale com a Viva e, embaixo, Entrar — nada entre
         "Fale com a Viva" e o Entrar; sem seletor-idioma-celular; sem rolagem lateral.
  Com a chave LIGADA (NEXT_PUBLIC_SELETOR_IDIOMA=on), a spec se pula: o lado ligado é da t742.
*/
const SAIDA = "tests/laboratorio/saida";
const LIGADA = process.env.NEXT_PUBLIC_SELETOR_IDIOMA === "on";
const PAGINAS = ["/", "/buscar", "/empresas", "/para-proprietarios"];
const ALTURA_TOPO = 72;

async function semGlobo(p: Page) {
  await expect(p.locator('[data-testid^="seletor-idioma"]')).toHaveCount(0);
  const textos = await p.getByTestId("topo-publico").evaluate((el) => (el as HTMLElement).innerText.split(/\s+/));
  expect(textos).not.toContain("PT");
  expect(textos).not.toContain("EN");
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T726 — PUBLICO-A: com a chave desligada, o topo público é o de antes (1280 e 390)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(LIGADA, "Chave ligada neste ambiente: o lado ligado é coberto pela t742.");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test("1280 px: nav-acoes só com Fale com a Viva e Entrar, mesma altura e mesma posição nas quatro páginas", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const medidas: { pagina: string; altura: number; entrarDireita: number; faleDireita: number }[] = [];
    for (const pagina of PAGINAS) {
      await p.goto(pagina, { waitUntil: "domcontentloaded" });
      const topo = p.getByTestId("topo-publico");
      await expect(topo).toBeVisible({ timeout: 20_000 });
      const acoes = topo.getByTestId("nav-acoes");
      const filhos = await acoes.evaluate((el) => Array.from(el.children).map((c) => (c.getAttribute("data-testid") ?? c.textContent?.trim() ?? "")));
      expect(filhos, `${pagina}: filhos de nav-acoes`).toEqual(["nav-fale-com-a-viva", "nav-entrar"]);
      await semGlobo(p);
      const t = (await topo.boundingBox())!;
      const fale = (await acoes.getByTestId("nav-fale-com-a-viva").boundingBox())!;
      const entrar = (await acoes.getByTestId("nav-entrar").boundingBox())!;
      // Fale com a Viva → Entrar a 16 px (gap-4), sem nada no meio.
      expect(Math.round(entrar.x - (fale.x + fale.width)), `${pagina}: vão entre Fale e Entrar`).toBe(16);
      medidas.push({ pagina, altura: Math.round(t.height), entrarDireita: Math.round(entrar.x + entrar.width), faleDireita: Math.round(fale.x + fale.width) });
      if (pagina === "/") await p.screenshot({ path: `${SAIDA}/t726-topo-desligada-1280.png`, clip: { x: 0, y: 0, width: 1280, height: t.height } });
    }
    // O mesmo topo em todas: mesma altura (h-18 + borda) e o Entrar no mesmo lugar.
    for (const m of medidas) {
      expect(m.altura, `${m.pagina}: altura do topo`).toBeGreaterThanOrEqual(ALTURA_TOPO);
      expect(m.altura, `${m.pagina}: altura do topo`).toBeLessThanOrEqual(ALTURA_TOPO + 1);
      expect(m.entrarDireita, `${m.pagina}: Entrar na margem direita (px-8)`).toBe(1280 - 32);
      expect(m.faleDireita, `${m.pagina}: Fale com a Viva no mesmo lugar`).toBe(medidas[0].faleDireita);
    }
    await ctx.close();
  });

  test("390 px: menu com os quatro destinos e o Entrar embaixo, nada entre eles, nas quatro páginas", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    for (const pagina of PAGINAS) {
      await p.goto(pagina, { waitUntil: "domcontentloaded" });
      const topo = p.getByTestId("topo-publico");
      await expect(topo).toBeVisible({ timeout: 20_000 });
      const t = (await topo.boundingBox())!;
      expect(Math.round(t.height), `${pagina}: altura do topo fechado`).toBeLessThanOrEqual(ALTURA_TOPO + 1);
      await topo.getByTestId("nav-menu").click();
      const lista = topo.getByTestId("nav-menu-lista");
      await expect(lista).toBeVisible();
      const itens = await lista.locator("a").evaluateAll((as) => as.map((a) => (a.textContent ?? "").trim()));
      expect(itens, `${pagina}: itens do menu`).toEqual(["Imóveis", "Anunciar", "Empresas", "Fale com a Viva", "Entrar"]);
      // Entre o "Fale com a Viva" e o bloco do Entrar não há outro elemento (onde o globo entraria com a chave ligada).
      const vizinho = await lista.getByRole("link", { name: "Fale com a Viva", exact: true }).evaluate((a) => (a.nextElementSibling as HTMLElement | null)?.querySelector("a")?.textContent?.trim() ?? null);
      expect(vizinho, `${pagina}: depois de Fale com a Viva vem o Entrar`).toBe("Entrar");
      await semGlobo(p);
      if (pagina === "/") await p.screenshot({ path: `${SAIDA}/t726-menu-desligada-390.png` });
      await topo.getByTestId("nav-menu").click();
    }
    await ctx.close();
  });
});
