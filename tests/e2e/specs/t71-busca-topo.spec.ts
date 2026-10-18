import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm } from "../fixtures/laboratorio";

/**
 * T71 — ordem d15ef6bf: topo da /buscar no padrão Airbnb/Furnished Finder.
 *  1. Cabeçalho limpo na /buscar (sem os links do meio): logo + ações.
 *  2. Barra de filtros no topo, CENTRALIZADA e em destaque; título fixo abaixo.
 *  3. Contagem "N imóveis em <cidade>" + "Salvar busca" (coração) ao lado.
 *  4. Visitante que toca em Salvar busca vai para o login e volta para a busca.
 *  5. Logado: salva, aparece em Buscas salvas, e o coração remove.
 *  6. Celular e 1024 px adaptam sem rolagem lateral.
 *  Ordem eac7e3a1: a busca vai para a MESMA linha do cabeçalho (busca compacta,
 *  estilo Airbnb); os filtros completos abrem num painel logo abaixo; sem faixa
 *  branca entre o cabeçalho e o conteúdo; cards da grade todos do mesmo tamanho.
 */
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T71 — topo da /buscar", () => {
  test("1–3. computador: topo limpo, filtros centralizados, título e contagem + Salvar busca", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    const header = page.locator("header").first();
    await expect(header.getByTestId("nav-links")).toBeHidden();
    await expect(header.getByRole("link", { name: "Para empresas" })).toBeHidden();
    await expect(header.getByRole("link", { name: "Entrar para anunciar" })).toBeVisible();

    // Busca compacta na mesma linha do logo e das ações.
    const compacta = header.getByTestId("busca-compacta");
    await expect(compacta).toBeVisible();
    await expect(compacta).toContainText("Uberlândia");
    const hBox = (await header.boundingBox())!;
    const cBox = (await compacta.boundingBox())!;
    expect(cBox.y).toBeGreaterThanOrEqual(hBox.y);
    expect(cBox.y + cBox.height).toBeLessThanOrEqual(hBox.y + hBox.height);
    // Centralizada no espaço entre o logo e as ações (o slot é flex-1): o logo é mais estreito que as
    // ações, então o centro da tela não é o alvo certo (ordem 75553f0a: spec acompanha o produto).
    const sBoxSlot = (await header.getByTestId("slot-busca-header").boundingBox())!;
    expect(Math.abs(cBox.x + cBox.width / 2 - (sBoxSlot.x + sBoxSlot.width / 2)), "busca compacta centralizada").toBeLessThanOrEqual(4);
    await expect(page.getByTestId("filtros-caixa")).toBeHidden();

    // Sem espaço branco morto: o título vem logo abaixo do cabeçalho.
    const h1 = page.getByRole("heading", { level: 1 });
    // Ordem 6a98c68e: o título acompanha a busca (local + contagem).
    await expect(h1).toHaveText(/^\d+ imóve(l|is) mobiliados? em Uberlândia$/);
    const h1Box = (await h1.boundingBox())!;
    expect(h1Box.y - (hBox.y + hBox.height), "título colado ao cabeçalho").toBeLessThanOrEqual(40);

    // Clicar abre os filtros completos, centralizados, logo abaixo do cabeçalho.
    await compacta.click();
    await expect(compacta).toHaveAttribute("aria-expanded", "true");
    const caixa = (await page.getByTestId("filtros-caixa").boundingBox())!;
    expect(Math.abs(caixa.x + caixa.width / 2 - 720), "barra centralizada").toBeLessThanOrEqual(24);
    expect(caixa.height, "barra numa linha").toBeLessThanOrEqual(64);
    expect(caixa.y, "painel abaixo do cabeçalho").toBeGreaterThanOrEqual(hBox.y + hBox.height);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-filtros-abertos-1440.png" });
    await page.getByTestId("fechar-painel-filtros").click();
    await expect(page.getByTestId("filtros-caixa")).toBeHidden();

    const total = page.getByTestId("complemento-busca");
    await expect(total).toContainText("R$ 0 de taxa para você");
    const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
    await expect(salvar).toHaveText(/Salvar busca/);
    const tBox = (await total.boundingBox())!;
    const sBox = (await salvar.boundingBox())!;
    expect(Math.abs(sBox.y + sBox.height / 2 - (tBox.y + tBox.height / 2)), "Salvar busca na linha abaixo do título").toBeLessThanOrEqual(12);
    expect(tBox.y).toBeGreaterThan(h1Box.y);
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-topo-1440.png" });

    // Outras páginas mantêm a navegação.
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("header").first().getByTestId("nav-links")).toBeVisible();
  });

  test("4. visitante: Salvar busca leva ao login e volta para a mesma busca", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
    await page.getByTestId("salvar-busca").filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/auth\?redirect=%2Fbuscar%3F.*local%3DUberl/);
  });

  test.describe("logado", () => {
    test.use({ storageState: authFile("inquilino") });
    test("5. salva, aparece em Buscas salvas e o coração remove", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
      const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
      await expect(salvar).toHaveText("Salvar busca", { timeout: 10_000 });
      await salvar.click();
      await expect(salvar).toHaveText("Busca salva", { timeout: 10_000 });
      await expect(salvar).toHaveAttribute("aria-pressed", "true");
      const { data } = await adm().from("buscas_salvas").select("parametros, resumo").ilike("parametros", "%pronto=1%");
      expect((data ?? []).some((r) => r.resumo.includes("Uberlândia") && r.resumo.includes("Pronto para Morar"))).toBe(true);

      await page.goto("/dashboard/buscas", { waitUntil: "networkidle" });
      await expect(page.getByTestId("buscas-salvas")).toContainText("Uberlândia · Pronto para Morar");

      await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
      await expect(salvar).toHaveText("Busca salva", { timeout: 10_000 });
      await salvar.click();
      await expect(salvar).toHaveText("Salvar busca", { timeout: 10_000 });
    });
  });

  test("6. celular 390 px e 1024 px adaptam sem quebrar", async ({ page }) => {
    test.setTimeout(120_000); // duas cargas da /buscar no servidor frio do laboratório (45 s não bastava)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    await expect(page.getByTestId("busca-celular")).toBeVisible();
    await expect(page.getByTestId("titulo-busca")).toContainText("em Uberlândia");
    await expect(page.getByTestId("salvar-busca").filter({ visible: true })).toBeVisible();
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-topo-390.png" });

    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await expect(page.locator("header").first().getByTestId("nav-acoes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
  });

  for (const [largura, altura] of [[1440, 900], [1280, 800], [1024, 800], [390, 844]] as const) {
    test(`7. cards da grade todos do mesmo tamanho a ${largura}px`, async ({ page }) => {
      test.setTimeout(120_000); // carga da /buscar com mapa no servidor frio do laboratório (45 s não bastava)
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const cards = page.getByTestId("card-resultado");
      expect(await cards.count()).toBeGreaterThanOrEqual(3);
      const caixas = await cards.evaluateAll((els) =>
        els.slice(0, 12).map((el) => {
          const r = el.getBoundingClientRect();
          const img = el.querySelector("img")?.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), iw: Math.round(img?.width ?? 0), ih: Math.round(img?.height ?? 0) };
        })
      );
      const unicos = (k: "w" | "h" | "iw" | "ih") => new Set(caixas.map((c) => c[k])).size;
      expect(unicos("w"), `larguras ${JSON.stringify(caixas)}`).toBe(1);
      expect(unicos("h"), `alturas ${JSON.stringify(caixas)}`).toBe(1);
      expect(unicos("iw"), "largura da foto").toBe(1);
      expect(unicos("ih"), "altura da foto").toBe(1);
    });
  }

  const contar = async (page: Page) => Number((await page.getByTestId("titulo-busca").innerText()).match(/^\d+/)?.[0] ?? 0);

  test("8. computador: título acompanha a cidade e os filtros em tempo real (ordem 6a98c68e)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    const titulo = page.getByTestId("titulo-busca");
    await expect(titulo).toHaveText(/^\d+ imóve(l|is) mobiliados? para locação mensal$/);
    const todos = await contar(page);

    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    await expect(titulo).toHaveText(/ em Uberlândia$/);
    const naCidade = await contar(page);
    expect(naCidade).toBeLessThanOrEqual(todos);

    await page.getByTestId("busca-compacta").click();
    await page.getByTestId("filtros-caixa").getByRole("button", { name: /Pronto para Morar/i }).click();
    await expect(titulo).toHaveText(/^(\d+|Nenhum) imóve(l|is) Pronto para Morar em Uberlândia$/);
    expect(await contar(page)).toBeLessThanOrEqual(naCidade);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-titulo-1440.png" });
  });

  test("9. celular: título acompanha a cidade digitada e os filtros (ordem 6a98c68e)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    const titulo = page.getByTestId("titulo-busca");
    await expect(titulo).toBeVisible();
    await expect(titulo).toHaveText(/para locação mensal$/);

    await page.getByTestId("busca-celular").getByPlaceholder("Cidade, bairro ou endereço").fill("Uberlândia");
    await expect(titulo).toHaveText(/^\d+ imóve(l|is) mobiliados? em Uberlândia$/);
    const naCidade = await contar(page);

    await page.getByTestId("abrir-filtros").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await painel.getByText("Aceita pets", { exact: true }).click();
    await painel.getByTestId("aplicar-filtros").click();
    await expect(titulo).toHaveText(/em Uberlândia que aceita(m)? pets$/);
    expect(await contar(page)).toBeLessThanOrEqual(naCidade);
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-titulo-390.png" });
  });
});

/** O elemento está na frente de tudo no próprio centro (nada por cima). */
const naFrente = (loc: import("@playwright/test").Locator) =>
  loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!topo && (topo === el || el.contains(topo));
  });

test.describe("T71 — Limpar filtros com o painel aberto (ordem 65116a07)", () => {
  test("computador: painel aberto não cobre 'Limpar filtros'; os dois botões limpam", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
    await page.getByTestId("busca-compacta").click();
    await expect(page.getByTestId("filtros-caixa")).toBeVisible();

    const daLinha = page.getByTestId("limpar-filtros");
    await expect(daLinha).toHaveText("Limpar filtros (1)");
    await expect(daLinha).toBeVisible();
    expect(await naFrente(daLinha), "Limpar da linha da contagem por cima do painel").toBe(true);
    const doPainel = page.getByTestId("limpar-filtros-painel");
    await expect(doPainel).toBeVisible();
    expect(await naFrente(doPainel)).toBe(true);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-limpar-painel-1440.png" });

    await daLinha.click();
    await expect(page).not.toHaveURL(/pronto=1/);
    await expect(daLinha).toHaveCount(0);

    // Rolado: o painel continua preso sob o cabeçalho, com o Limpar dele à vista.
    if (!(await page.getByTestId("filtros-caixa").isVisible())) await page.getByTestId("busca-compacta").click();
    await page.getByTestId("filtros-caixa").getByRole("button", { name: /Pronto para Morar/i }).click();
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(300);
    await expect(doPainel).toBeVisible();
    expect(await naFrente(doPainel), "Limpar do painel com a página rolada").toBe(true);
    await doPainel.click();
    await expect(page).not.toHaveURL(/pronto=1/);
    await expect(page.getByTestId("filtros-caixa"), "Limpar do painel não fecha o painel").toBeVisible();
  });

  test("celular: painel de filtros aberto mostra 'Limpar' clicável por cima de tudo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?pet=1", { waitUntil: "networkidle" });
    await page.getByTestId("abrir-filtros").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel).toBeVisible();
    const limpar = painel.getByRole("button", { name: "Limpar", exact: true });
    await expect(limpar).toBeVisible();
    expect(await naFrente(limpar), "Limpar do painel do celular por cima do botão da Viva e da barra de abas").toBe(true);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-limpar-painel-390.png" });
    await limpar.click();
    await painel.getByTestId("aplicar-filtros").click();
    await expect(page).not.toHaveURL(/pet=1/);
    await expect(page.getByTestId("abrir-filtros")).toHaveAccessibleName("Filtros");
  });
});
