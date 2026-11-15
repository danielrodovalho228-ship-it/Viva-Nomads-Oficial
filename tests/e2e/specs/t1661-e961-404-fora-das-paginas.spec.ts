import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1661 — E961: a página 404 não viaja dentro das outras páginas.
  O Next monta o not-found.tsx da raiz em todo pedido e manda o resultado no HTML de cada página. A 404 lia os imóveis
  no servidor e desenhava três cartões: toda página do site carregava esses cartões (com preço) no próprio HTML, e
  pagava a consulta. O t348 acusava isso em /dashboard/leads ("R$ <número>" na tela do dono).
   1. o HTML que o servidor manda para páginas sem vitrine não tem cartão de imóvel (públicas) nem preço (tela logada);
   2. a 404 de verdade segue respondendo 404 e mostrando os destaques, que agora chegam pelo cliente.
*/
const senha = novaSenha();
const dono = { email: `dono.t1661.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Destaque", role: "owner" as const };
let id: string | undefined;

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
      expect(await r!.text(), "o servidor não desenha cartão na 404").not.toContain("cartao-imovel");
      await expect(page.locator("h1:visible")).toHaveText(["Página não encontrada"]);
      const vitrine = page.getByTestId("nao-encontrada-vitrine");
      await expect(vitrine).toHaveAttribute("data-estado", disponiveis > 0 ? "pronto" : "vazio", { timeout: 30_000 });
      await expect(page.getByTestId("nao-encontrada-destaques").getByTestId("cartao-imovel")).toHaveCount(Math.min(3, disponiveis));
      if (disponiveis > 0) await expect(page.getByRole("heading", { level: 2, name: "Imóveis em destaque" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t1661-404-${largura}.png`, fullPage: true });
    });
  }
});
