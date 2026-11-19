import { test, expect } from "@playwright/test";

/**
 * T1629 — FAMÍLIA 2 (rotas e remissões): cada rota corrigida responde com destino vivo (200, ou redirecionamento para a
 * rota canônica), a 390 px, sem login.
 *  - E885 /entrar → /auth · E851 /contato → /ajuda/fale-com-a-viva e /sobre (200) · E922 /ajuda/para-empresas → /empresas
 *  - E874 /cidades (índice) e a 2ª cidade sem 404 · E916 a 404 tem rodapé e busca · E889 /imoveis-perto-de lista imóveis
 *  - E921 o guia de bairro mostra os atalhos como links · E836 o guia de precificação não remete a /precos
 */
const REDIRECTS: [string, RegExp][] = [
  ["/entrar", /\/auth(\?|$)/],
  ["/contato", /\/ajuda\/fale-com-a-viva$/],
  ["/ajuda/para-empresas", /\/empresas$/],
];

test.describe("T1629 — Família 2: rotas vivas", () => {
  test.beforeEach(async ({ page }) => page.setViewportSize({ width: 390, height: 844 }));

  for (const [de, para] of REDIRECTS) {
    test(`${de} → destino vivo`, async ({ page }) => {
      const r = await page.goto(de, { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0, `${de} responde`).toBeLessThan(400);
      await expect(page).toHaveURL(para);
    });
  }

  test("E851 /sobre responde 200, com contato e fase do site; o rodapé liga para /sobre", async ({ page }) => {
    const r = await page.goto("/sobre", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("sobre-fase")).toContainText(/lançamento oficial/i);
    await expect(page.getByTestId("sobre-contato")).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
    await expect(page.locator('footer a[href="/sobre"]')).toHaveCount(1);
  });

  test("E874 /cidades é índice e toda cidade dele abre sem 404", async ({ page }) => {
    const r = await page.goto("/cidades", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const hrefs = await page.locator('main a[href^="/cidades/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
    expect(hrefs.length, "o índice lista cidades").toBeGreaterThanOrEqual(1);
    for (const h of hrefs.slice(0, 4)) {
      const rc = await page.request.get(h);
      expect(rc.status(), `${h} responde`).toBeLessThan(400);
    }
  });

  test("E916 a 404 tem o rodapé do site e a busca", async ({ page }) => {
    const r = await page.goto("/rota-que-nao-existe-e916", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await expect(page.getByTestId("nao-encontrada-busca")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await page.getByTestId("nao-encontrada-busca").locator('input[name="local"]').fill("Uberlândia");
    // E1019 (diagnóstico): na corrida completa o formulário chegou a ser enviado vazio. Esta linha diz em que passo o
    // valor se perde: se falhar aqui, o campo não ficou com o texto; se passar e a URL vier sem ?local=, perdeu-se depois.
    await expect(page.getByTestId("nao-encontrada-busca").locator('input[name="local"]')).toHaveValue("Uberlândia");
    await page.getByTestId("nao-encontrada-busca").locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/buscar\?local=Uberl/);
  });

  test("E1019 (prova de 19/11) o termo da busca da 404 sobrevive a seguir por \"Buscar imóveis\" e voltar", async ({ page }) => {
    await page.goto("/rota-que-nao-existe-e1019", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("nao-encontrada-busca").locator('input[name="local"]');
    await campo.click();
    await campo.pressSequentially("apartamento teste e1019");
    // O link leva o termo (a outra busca da página).
    await expect(page.getByTestId("nao-encontrada-buscar-imoveis")).toHaveAttribute("href", "/buscar?local=apartamento%20teste%20e1019");
    await page.getByTestId("nao-encontrada-buscar-imoveis").click();
    await expect(page).toHaveURL(/\/buscar\?local=apartamento/);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    // Voltar DEPOIS de a /buscar carregar por completo: o campo volta com o termo (pela URL da 404), sem depender da cache.
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/rota-que-nao-existe-e1019\?local=apartamento/);
    await expect(page.getByTestId("nao-encontrada-busca").locator('input[name="local"]')).toHaveValue("apartamento teste e1019");
  });

  test("E921 o guia de bairro mostra os atalhos como links vivos; E836 o guia de precificação sem /precos", async ({ page }) => {
    await page.goto("/guias/como-escolher-bairro-em-uberlandia", { waitUntil: "domcontentloaded" });
    const atalhos = page.getByTestId("guia-atalho");
    await expect(atalhos.first()).toBeVisible({ timeout: 30_000 });
    for (const href of await atalhos.evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
      const rc = await page.request.get(href);
      expect(rc.status(), `${href} responde`).toBeLessThan(400);
    }
    await expect(page.locator("main")).not.toContainText("filtram os imóveis por proximidade");
    await page.goto("/guias/como-precificar-estadia-de-meses", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).not.toContainText("/precos");
    await expect(page.locator("main")).toContainText("Quanto mais imóveis ativos, menor a taxa");
  });

  test("E889 /imoveis-perto-de/<destino> lista imóveis quando a região tem imóveis (massa de exemplo)", async ({ page }) => {
    await page.goto("/cidades/uberlandia/hc-ufu-umuarama", { waitUntil: "domcontentloaded" });
    const links = page.getByTestId("polo-perto-de").locator("a");
    test.skip((await links.count()) === 0, "nenhum destino ativo cadastrado neste banco");
    const regiao = await page.getByTestId("polo-anuncios").locator("article, [data-testid='card-resultado'], a[href^='/imoveis/']").count();
    await links.first().click();
    await expect(page).toHaveURL(/\/imoveis-perto-de\//);
    if (regiao > 0) await expect(page.getByTestId("perto-de-cartao").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("perto-de-vazio")).toHaveCount(regiao > 0 ? 0 : 1);
  });
});
