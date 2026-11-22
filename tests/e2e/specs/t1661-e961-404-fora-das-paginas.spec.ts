import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1661 — E961: a página 404 não viaja dentro das outras páginas.
  O Next monta o not-found.tsx da raiz em todo pedido e manda o resultado no HTML de cada página. A 404 lia os imóveis
  no servidor e desenhava três cartões: toda página do site carregava esses cartões (com preço) no próprio HTML, e
  pagava a consulta. O t348 acusava isso em /dashboard/leads ("R$ <número>" na tela do dono).
   1. o HTML que o servidor manda para páginas sem vitrine não tem cartão de imóvel (públicas) nem preço (tela logada);
   2. a 404 de verdade segue respondendo 404 e mostrando os destaques, que agora chegam pelo cliente;
   3. enquanto eles não chegam, três cartões-fantasma ocupam o lugar, e a página não salta na troca.
*/
const senha = novaSenha();
const dono = { email: `dono.t1661.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Destaque", role: "owner" as const };
let id: string | undefined;

/** Quanto o conteúdo abaixo da vitrine pode andar quando os destaques tomam o lugar do esqueleto. */
const TOLERANCIA_DO_SALTO_PX = 8;

/** O que marca a vitrine da 404 e um cartão de imóvel no HTML (texto desenhado ou dado embutido). */
const MARCAS = ["nao-encontrada-destaques", "cartao-imovel", "cartao-preco-mes", "Imóveis em destaque"];

test.describe("T1661 — E961: a 404 fora do HTML das outras páginas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    id = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  test("páginas públicas sem vitrine: o HTML do servidor não traz cartão de imóvel nem a vitrine da 404", async ({ request }) => {
    // Sem cobrança de "R$" aqui: páginas de texto como /termos citam valores de propósito. O preço é cobrado na tela logada.
    for (const rota of ["/ajuda", "/auth", "/termos"]) {
      const r = await request.get(rota);
      expect(r.status(), rota).toBe(200);
      const html = await r.text();
      for (const marca of MARCAS) expect(html, `${rota}: "${marca}" no HTML`).not.toContain(marca);
    }
  });

  test("tela logada do dono (/dashboard/leads): o HTML do servidor não traz cartão de imóvel nem preço", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, dono.email, senha);
    const r = await page.request.get("/dashboard/leads");
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html, "é a tela do painel, não o login").toContain("painel-nao-encontrado");
    for (const marca of MARCAS) expect(html, `"${marca}" no HTML`).not.toContain(marca);
    expect(html, "preço no HTML").not.toMatch(/R\$\s?\d/);
  });

  for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
    test(`${largura} px: a 404 de verdade responde 404 e mostra os destaques, vindos do cliente`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      const disponiveis = ((await (await page.request.get("/api/properties")).json()) as { properties: unknown[] }).properties.length;
      const r = await page.goto("/pagina-que-nao-existe-t1661", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(404);
      const htmlDoServidor = await r!.text();
      expect(htmlDoServidor, "o servidor não desenha cartão na 404").not.toContain("cartao-imovel");
      // Do servidor sai o esqueleto: três cartões-fantasma no lugar dos destaques (ORDEM-DUET-069).
      expect(htmlDoServidor.match(/data-testid="skeleton-cartao"/g) ?? [], "três cartões-fantasma no HTML do servidor").toHaveLength(3);
      await expect(page.locator("h1:visible")).toHaveText(["Página não encontrada"]);
      const vitrine = page.getByTestId("nao-encontrada-vitrine");
      await expect(vitrine).toHaveAttribute("data-estado", disponiveis > 0 ? "pronto" : "vazio", { timeout: 30_000 });
      await expect(page.getByTestId("nao-encontrada-destaques").getByTestId("cartao-imovel")).toHaveCount(Math.min(3, disponiveis));
      if (disponiveis > 0) await expect(page.getByRole("heading", { level: 2, name: "Imóveis em destaque" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
      await expect(page.getByTestId("nao-encontrada-esqueleto")).toHaveCount(0);
      await page.screenshot({ path: `tests/laboratorio/saida/t1661-404-${largura}.png`, fullPage: true });
    });

    test(`${largura} px: os destaques chegam sem empurrar a página (esqueleto com as dimensões do cartão)`, async ({ browser, page }) => {
      const disponiveis = ((await (await page.request.get("/api/properties")).json()) as { properties: unknown[] }).properties.length;
      test.skip(disponiveis === 0, "Sem imóvel neste ambiente: a vitrine some e não há o que comparar.");
      const topoDoLink = (p: typeof page) => p.getByTestId("nao-encontrada-anunciar").evaluate((e) => Math.round(e.getBoundingClientRect().top + window.scrollY));
      // Sem JavaScript a 404 fica como o servidor a mandou: com o esqueleto.
      const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, javaScriptEnabled: false });
      const semJs = await ctx.newPage();
      await semJs.goto("/pagina-que-nao-existe-t1661", { waitUntil: "load" });
      await expect(semJs.getByTestId("skeleton-cartao").first()).toBeVisible();
      const antes = await topoDoLink(semJs);
      await ctx.close();
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/pagina-que-nao-existe-t1661", { waitUntil: "load" });
      await expect(page.getByTestId("nao-encontrada-vitrine")).toHaveAttribute("data-estado", "pronto", { timeout: 30_000 });
      await expect(page.getByTestId("nao-encontrada-destaques").locator("img").first()).toBeVisible();
      const depois = await topoDoLink(page);
      console.log(`SALTO ${largura}: esqueleto ${antes}px, destaques ${depois}px, diferença ${depois - antes}px`);
      expect(Math.abs(depois - antes), `o link abaixo da vitrine andou ${depois - antes} px quando os destaques chegaram`).toBeLessThanOrEqual(TOLERANCIA_DO_SALTO_PX);
    });
  }
});
