import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm } from "../fixtures/laboratorio";

/**
 * T71 — ordem d15ef6bf: topo da /buscar no padrão Airbnb/Furnished Finder.
 *  1. Cabeçalho limpo na /buscar (sem os links do meio): logo + ações.
 *  2. Barra de filtros no topo, em destaque; título fixo abaixo (E82-A: a linha de pílulas, alinhada à lista).
 *  3. Contagem "N imóveis em <cidade>" + "Salvar busca" (coração) ao lado.
 *  4. Visitante que toca em Salvar busca vai para o login e volta para a busca.
 *  5. Logado: salva, aparece em Buscas salvas, e o coração remove.
 *  6. Celular e 1024 px adaptam sem rolagem lateral.
 *  Ordem eac7e3a1: sem faixa branca entre o cabeçalho e o conteúdo; cards da grade todos do mesmo tamanho.
 *  E82-A + E91: a busca compacta saiu do cabeçalho. No lugar, UMA linha de pílulas (a mesma em toda largura) com o
 *  painel de cada pílula logo abaixo dela, e a linha da contagem "N imóveis em <cidade>" + Salvar busca + Descrever.
 */
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Campo de cidade/bairro no painel da pílula Local (o texto de exemplo muda com ou sem o Mapbox). */
const campoLocal = (page: Page) => page.getByTestId("painel-pilula-local").getByPlaceholder(/^(Cidade ou bairro|Endereço, bairro ou cidade)$/);

test.describe("T71 — topo da /buscar", () => {
  test("1–3. computador: topo limpo, pílulas numa linha, título e contagem + Salvar busca", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    const header = page.locator("header").first();
    await expect(header.getByTestId("nav-links")).toBeHidden();
    await expect(header.getByRole("link", { name: "Para empresas" })).toBeHidden();
    await expect(header.getByRole("link", { name: "Entrar para anunciar" })).toBeVisible();

    const hBox = (await header.boundingBox())!;
    // E82-A: sem busca compacta no cabeçalho — a linha de pílulas logo abaixo dele, numa linha só.
    await expect(page.getByTestId("busca-compacta")).toHaveCount(0);
    const linha = page.getByTestId("linha-pilulas");
    await expect(linha).toBeVisible();
    await expect(page.getByTestId("pilula-local")).toHaveAttribute("data-valor", "Uberlândia");
    const lBox = (await linha.boundingBox())!;
    expect(lBox.y, "pílulas abaixo do cabeçalho").toBeGreaterThanOrEqual(hBox.y + hBox.height);
    expect(lBox.y - (hBox.y + hBox.height), "pílulas coladas ao cabeçalho").toBeLessThanOrEqual(40);
    expect(lBox.height, "pílulas numa linha").toBeLessThanOrEqual(64);

    // Sem espaço branco morto: a contagem vem logo abaixo das pílulas.
    const h1 = page.getByRole("heading", { level: 1 });
    // E91: a linha da contagem acompanha a busca (contagem + local).
    await expect(h1).toHaveText(/^\d+ imóve(l|is) em Uberlândia$/);
    const h1Box = (await h1.boundingBox())!;
    expect(h1Box.y - (lBox.y + lBox.height), "contagem colada às pílulas").toBeLessThanOrEqual(40);

    // Clicar numa pílula abre o painel dela logo abaixo da linha; "Fechar" fecha.
    const preco = page.getByTestId("pilula-preco");
    await preco.click();
    await expect(preco).toHaveAttribute("aria-expanded", "true");
    const painel = page.getByTestId("painel-pilula-preco");
    await expect(painel).toBeVisible();
    const pBox = (await painel.boundingBox())!;
    expect(pBox.y, "painel abaixo da linha de pílulas").toBeGreaterThanOrEqual(lBox.y + lBox.height);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-filtros-abertos-1440.png" });
    await page.getByTestId("painel-pilula-fechar").click();
    await expect(painel).toHaveCount(0);

    // A linha da contagem: "· R$ 0 de taxa para você" + Salvar busca + "Descrever o que procuro", na mesma linha.
    const total = page.getByTestId("complemento-busca");
    await expect(total).toContainText("R$ 0 de taxa para você");
    const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
    await expect(salvar).toHaveText(/Salvar busca/);
    const tBox = (await total.boundingBox())!;
    const sBox = (await salvar.boundingBox())!;
    expect(Math.abs(sBox.y + sBox.height / 2 - (tBox.y + tBox.height / 2)), "Salvar busca na linha da contagem").toBeLessThanOrEqual(12);
    expect(Math.abs(tBox.y + tBox.height / 2 - (h1Box.y + h1Box.height / 2)), "complemento na linha da contagem").toBeLessThanOrEqual(12);
    expect(tBox.x).toBeGreaterThan(h1Box.x);
    await expect(page.getByTestId("linha-contagem").getByTestId("abrir-descrever")).toBeVisible();
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-topo-1440.png" });

    // Outras páginas mantêm a navegação.
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("header").first().getByTestId("nav-links")).toBeVisible();
  });

  test("4. visitante: Salvar busca guarda no aparelho (Prompt 49), sem pedir conta", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
    const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
    await salvar.click();
    await expect(salvar).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/buscar\?/);
    expect(await page.evaluate(() => localStorage.getItem("vivanomads-buscas-convidado"))).toContain("Uberl");
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
    // E82-A: sem bloco só do celular — a mesma linha de pílulas (ela rola de lado por dentro; a página, não).
    await expect(page.getByTestId("busca-celular")).toHaveCount(0);
    await expect(page.getByTestId("linha-pilulas")).toBeVisible();
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
          // Caixa da foto (aspect 4:3), não o <img>: cartão sem foto real usa o espaço reservado (sem <img>) e dava 0 px (lab 5d5f433e).
          const img = (el.querySelector('[class*="aspect-"]') ?? el.querySelector("img"))?.getBoundingClientRect();
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
    // E91: "N imóveis" (com a cidade só quando a lista inteira é de uma cidade).
    await expect(titulo).toHaveText(/^\d+ imóve(l|is)( em .+)?$/);
    const todos = await contar(page);

    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    await expect(titulo).toHaveText(/ em Uberlândia$/);
    const naCidade = await contar(page);
    expect(naCidade).toBeLessThanOrEqual(todos);

    // FILTROS-1 (E43): "Pronto para Morar" fica só na folha de filtros; E82-A: a folha abre por "Mais filtros".
    await page.getByTestId("pilula-mais").click();
    await page.getByTestId("faceta-pronto").click();
    await page.getByTestId("aplicar-filtros").click();
    // E91: a contagem não diz mais o filtro ("Pronto para Morar" saiu do título).
    await expect(titulo).toHaveText(/^(\d+ imóve(l|is) em Uberlândia|Nenhum imóvel com estes filtros)$/);
    expect(await contar(page)).toBeLessThanOrEqual(naCidade);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-titulo-1440.png" });
  });

  test("9. celular: título acompanha a cidade digitada e os filtros (ordem 6a98c68e)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    const titulo = page.getByTestId("titulo-busca");
    await expect(titulo).toBeVisible();
    await expect(titulo).toHaveText(/^\d+ imóve(l|is)( em .+)?$/);

    // E82-A: a cidade se digita no painel da pílula Local.
    await page.getByTestId("pilula-local").click();
    await campoLocal(page).fill("Uberlândia");
    await expect(titulo).toHaveText(/^\d+ imóve(l|is) em Uberlândia$/);
    const naCidade = await contar(page);
    // Esc fecha a lista de sugestões e, depois, o painel (o "Fechar" pode ficar sob as sugestões).
    await page.keyboard.press("Escape");
    if (await page.getByTestId("painel-pilula-local").isVisible()) await page.keyboard.press("Escape");
    await expect(page.getByTestId("painel-pilula-local")).toHaveCount(0);

    await page.getByTestId("pilula-mais").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await painel.getByRole("button", { name: "Aceita pets", exact: true }).click();
    await painel.getByTestId("aplicar-filtros").click();
    // E91: a contagem não diz mais o filtro ("que aceitam pets" saiu do título).
    await expect(page).toHaveURL(/pet=1/);
    await expect(titulo).toHaveText(/^(\d+ imóve(l|is) em Uberlândia|Nenhum imóvel com estes filtros)$/);
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
  test("computador: 'Limpar tudo' da folha e a opção desligada na pílula limpam", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
    // E82-A: "Limpar filtros (N)" saiu da linha da contagem e da faixa; limpa-se pelo "Limpar tudo" da folha ou
    // desligando a opção da pílula.
    await expect(page.getByTestId("limpar-filtros")).toHaveCount(0);
    await expect(page.getByTestId("limpar-filtros-painel")).toHaveCount(0);

    await page.getByTestId("pilula-mais").click();
    const folha = page.getByRole("dialog", { name: "Filtros" });
    await expect(folha.getByTestId("faceta-pronto")).toHaveAttribute("aria-pressed", "true");
    const limpar = folha.getByTestId("limpar-tudo");
    await expect(limpar).toBeVisible();
    expect(await naFrente(limpar), "Limpar tudo da folha por cima de tudo").toBe(true);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-limpar-painel-1440.png" });
    await limpar.click();
    await folha.getByTestId("aplicar-filtros").click();
    await expect(page).not.toHaveURL(/pronto=1/);

    // Pílula: tocar de novo na opção escolhida desliga o filtro.
    await page.getByTestId("pilula-preco").click();
    const painelPreco = page.getByTestId("painel-pilula-preco");
    await painelPreco.locator('[data-testid^="pilula-preco-"]:not([disabled])').first().click();
    await expect(page).toHaveURL(/preco=\d+/);
    await expect(page.getByTestId("pilula-preco")).not.toHaveAttribute("data-valor", "");
    await painelPreco.locator('[data-testid^="pilula-preco-"][aria-pressed="true"]').click();
    await expect(page).not.toHaveURL(/preco=/);
    await expect(page.getByTestId("pilula-preco")).toHaveAttribute("data-valor", "");
  });

  test("celular: painel de filtros aberto mostra 'Limpar' clicável por cima de tudo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?pet=1", { waitUntil: "networkidle" });
    await page.getByTestId("pilula-mais").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel).toBeVisible();
    const limpar = painel.getByRole("button", { name: "Limpar tudo", exact: true }); // Prompt 40: terciário "Limpar tudo"
    await expect(limpar).toBeVisible();
    expect(await naFrente(limpar), "Limpar do painel do celular por cima da barra de abas").toBe(true);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-limpar-painel-390.png" });
    await limpar.click();
    await painel.getByTestId("aplicar-filtros").click();
    await expect(page).not.toHaveURL(/pet=1/);
    await expect(page.getByTestId("pilula-mais")).not.toContainText("(");
  });
});
