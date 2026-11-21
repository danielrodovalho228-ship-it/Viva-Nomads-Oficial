import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1566 — guarda permanente dos merges de 08/11 que ainda não tinham spec de laboratório (determinística, 390 e 1280 px):
    E718 (#3467)  /para-proprietarios: os 3 blocos do mockup (pedidos da cidade, "Publicamos para você", simulador), links certos, imagem carregada,
                  nenhum valor em R$ no simulador, sem estouro.
    E723 (#3496)  /buscar: o aviso "só anúncios de exemplo" aparece se, e somente se, TODOS os cartões são de exemplo.
    E726 (#3497)  cartões da busca: o selo "Anúncio de exemplo" fica numa posição só (linha de baixo, à esquerda do cartão) e o exemplo não mostra nota.
    E730 (#3504)  /parceiros: a nota diz o que o formulário entrega (categorias de serviço) e para onde vão os outros tipos.
    E731 (#3506)  /parceiros: o rótulo do envio segue a sessão (visitante: "Continuar: criar conta ou entrar"; logado: "Enviar pedido de parceria").
    E720 (#3455)  painel: "← Voltar" no topo das telas internas; não no início do painel nem nas telas com voltar próprio; leva ao início.
  Só spec; defeito novo vira item numerado (L-110+).
*/
const TAMANHOS = [{ w: 390, h: 844 }, { w: 1280, h: 900 }] as const;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1566.${sufixo}@lab.vivanomads.test`, nome: "Dora Guarda", role: "owner" as const };
const ids: Record<string, string> = {};
const semRolagem = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T1566 — guarda dos merges de 08/11 (públicas)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const { w, h } of TAMANHOS) {
    test(`E718 a ${w} px: /para-proprietarios tem os 3 blocos, links certos, imagem carregada e nenhum valor em R$ no simulador`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/para-proprietarios", { waitUntil: "load" });
      const bloco = page.getByTestId("proprietarios-blocos-mockup");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("proprietarios-pedidos-cidade")).toBeVisible();
      await expect(page.getByTestId("proprietarios-publicamos")).toBeVisible();
      await expect(page.getByTestId("proprietarios-simulador")).toBeVisible();
      await expect(page.getByTestId("proprietarios-ver-pedidos")).toHaveAttribute("href", "/dashboard/pedidos-cidade");
      await expect(page.getByTestId("proprietarios-pedir-ajuda")).toHaveAttribute("href", "/dashboard/imoveis/novo");
      await expect(page.getByTestId("proprietarios-calcular")).toHaveAttribute("href", "/dashboard/simulador");
      expect(await page.getByTestId("proprietarios-simulador").innerText(), "o simulador começa vazio (E294)").not.toMatch(/R\$\s*\d/);
      const img = page.getByTestId("proprietarios-publicamos").locator("img").first();
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      expect(await semRolagem(page), "rolagem lateral").toBeLessThanOrEqual(0);
    });

    test(`E723 + E726 a ${w} px: /buscar — aviso de só-exemplos coerente com os cartões; selo do exemplo numa posição só, sem nota`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const cartoes = page.getByTestId("cartao-imovel");
      await expect(cartoes.first()).toBeVisible({ timeout: 30_000 });
      const total = await cartoes.count();
      const selos = await page.getByTestId("cartao-selo-exemplo").count();
      // E723: o aviso existe se e somente se todos os cartões são de exemplo
      await expect(page.getByTestId("busca-so-exemplos")).toHaveCount(selos === total ? 1 : 0);
      // E726: cada selo fica abaixo do local, alinhado à esquerda do texto do cartão, e o cartão de exemplo não mostra nota
      const medidas = await cartoes.evaluateAll((els) =>
        els.map((el) => {
          const selo = el.querySelector("[data-testid=cartao-selo-exemplo]");
          if (!selo) return null;
          const local = el.querySelector("[data-testid=cartao-local]")!.getBoundingClientRect();
          const s = selo.getBoundingClientRect();
          return { esquerda: Math.round(s.left - local.left), abaixo: s.top >= local.bottom - 1, nota: !!el.querySelector("[data-testid=cartao-nota]") };
        }).filter(Boolean),
      );
      for (const m of medidas) expect(m, JSON.stringify(m)).toEqual({ esquerda: 0, abaixo: true, nota: false });
      expect(await semRolagem(page), "rolagem lateral").toBeLessThanOrEqual(0);
    });

    test(`E730 + E731 a ${w} px: /parceiros — nota do formulário e rótulo do visitante`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const nota = page.getByTestId("parceiros-tipos-nota");
      await expect(nota).toBeVisible({ timeout: 30_000 });
      await expect(nota).toContainText("categorias de serviço");
      await expect(nota).toContainText("Empresas e gestores têm página própria");
      expect(await page.title()).toContain("serviços");
      await expect(page.getByTestId("seja-parceiro-enviar")).toHaveText("Continuar: criar conta ou entrar");
      expect(await semRolagem(page), "rolagem lateral").toBeLessThanOrEqual(0);
    });
  }
});

test.describe("T1566 — guarda dos merges de 08/11 (logado)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("E731: logado, o rótulo do envio em /parceiros é 'Enviar pedido de parceria'", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("seja-parceiro-enviar")).toHaveText("Enviar pedido de parceria", { timeout: 30_000 });
    await p.context().close();
  });

  for (const { w, h } of TAMANHOS) {
    test(`E720 a ${w} px: '← Voltar' no topo das telas internas, ausente no início e nas telas com voltar próprio, leva ao início`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: h });
      await p.goto("/dashboard/simulador", { waitUntil: "domcontentloaded" });
      const voltar = p.getByTestId("voltar-painel");
      await expect(voltar).toBeVisible({ timeout: 30_000 });
      await expect(voltar).toContainText("Voltar");
      const caixa = (await voltar.boundingBox())!;
      expect(caixa.height, "alvo de toque").toBeGreaterThanOrEqual(40);
      expect(caixa.x + caixa.width, "dentro da tela").toBeLessThanOrEqual(w);
      for (const sem of ["/dashboard", "/dashboard/notificacoes"]) {
        await p.goto(sem, { waitUntil: "domcontentloaded" });
        await expect(p.locator("main, body").first()).toBeVisible();
        await expect(p.getByTestId("voltar-painel"), `${sem} não repete o voltar`).toHaveCount(0);
      }
      await p.goto("/dashboard/simulador", { waitUntil: "domcontentloaded" });
      await p.getByTestId("voltar-painel").click();
      await expect(p).toHaveURL(/\/dashboard\/?$/, { timeout: 20_000 });
      await p.context().close();
    });
  }
});
