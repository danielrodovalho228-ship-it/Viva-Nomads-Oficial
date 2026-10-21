import { test, expect, type Page, type Locator, type APIRequestContext } from "@playwright/test";

/*
  T244 — Prompt 40, fundação visual (Estudo 1), público, 390 e 1280 px. Matriz do QA do Muse, um print por linha:
   1. home: cartões sem caixa (sem borda, sem sombra), foto 4:3 com raio de 12 px;
   2. /buscar: barra de busca em pill, chips (selecionado = tinta), folha de filtros aberta com a contagem ao vivo
      (celular: de baixo para cima; computador: painel lateral);
   3. favoritos; 4. /cidades/uberlandia; 5. "Imóveis parecidos" na página do imóvel;
   6. esqueleto no formato do cartão com rede lenta simulada (page.route com atraso);
   7. coração: 1 toque salva, outro desfaz (aria-pressed);
   8. botões: altura 52 (celular) / 56 (computador), raio 8, cor (getComputedStyle);
   9. adendo: cartão na ordem nova (bairro + nota → título em até 2 linhas → total do mês · total da estadia →
      síntese → disponibilidade; 1 selo; carrossel com pontos), cinzas do texto corrido (#3F3F3F; #6A6A6A só
      em miúdo) e sombra só no que flutua.
  E as provas da folha: "contagem do botão = itens da lista" e "Limpar tudo zera".
  Na /buscar os anúncios de exemplo só aparecem com ?exemplos=1 quando há imóveis reais (Prompt 30).
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);
const VERDE = "rgb(28, 107, 58)";
const TINTA = "rgb(34, 34, 34)";
const BRANCO = "rgb(255, 255, 255)";
const SECUNDARIO = "rgb(63, 63, 63)"; // #3F3F3F (adendo)
const APOIO = "rgb(106, 106, 106)"; // #6A6A6A, só miúdo

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

const estilo = (loc: Locator) =>
  loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      altura: Math.round(r.height),
      largura: Math.round(r.width),
      x: Math.round(r.x),
      raio: cs.borderTopLeftRadius,
      fundo: cs.backgroundColor,
      cor: cs.color,
      borda: cs.borderTopWidth,
      corBorda: cs.borderTopColor,
      sombra: cs.boxShadow,
      peso: cs.fontWeight,
      sublinhado: cs.textDecorationLine,
    };
  });

/** Cartão de anúncio no padrão: o <a> sem caixa e a foto 4:3 com raio de 12 px. */
async function conferirCartao(cartao: Locator, onde: string) {
  const link = await estilo(cartao.locator("a").first());
  expect(link.borda, `${onde}: cartão sem borda`).toBe("0px");
  expect(link.sombra, `${onde}: cartão sem sombra`).toBe("none");
  expect(link.fundo, `${onde}: cartão sem fundo de caixa`).toBe("rgba(0, 0, 0, 0)");
  const foto = await estilo(cartao.getByTestId("cartao-foto"));
  expect(foto.raio, `${onde}: foto com raio de 12 px`).toBe("12px");
  expect(Math.abs(foto.largura / foto.altura - 4 / 3), `${onde}: foto 4:3 (${foto.largura}×${foto.altura})`).toBeLessThan(0.03);
  await expect(cartao.getByTestId("cartao-total-mes")).toContainText("/mês");
  await expect(cartao.getByTestId("cartao-total-mes"), `${onde}: sem "total" solto`).not.toContainText("total");
  await expect(cartao.getByTestId("ideal-para"), `${onde}: "Ideal para" fora do cartão`).toHaveCount(0);
  const preco = await estilo(cartao.getByTestId("cartao-total-mes").locator("span").first());
  expect(preco.peso, `${onde}: valor mensal em 600`).toBe("600");
  expect(preco.cor, `${onde}: valor mensal no verde de marca`).toBe(VERDE);
  // O preço é o maior texto do cartão.
  const tamanhos = await cartao.evaluate((el) => {
    const px = (s: string) => Number.parseFloat(s);
    const preco = el.querySelector('[data-testid="cartao-total-mes"] span') as HTMLElement;
    const outros = Array.from(el.querySelectorAll<HTMLElement>("h3, p, span")).filter((n) => !n.closest('[data-testid="cartao-total-mes"]') && !n.closest('[data-testid="selos-foto"]') && n.offsetParent !== null);
    return { preco: px(getComputedStyle(preco).fontSize), maior: Math.max(...outros.map((n) => px(getComputedStyle(n).fontSize))) };
  });
  expect(tamanhos.preco, `${onde}: preço é o maior texto`).toBeGreaterThan(tamanhos.maior);
  const titulo = await estilo(cartao.getByTestId("cartao-local"));
  expect(titulo.peso).toBe("600");
  const fonte = await cartao.getByTestId("cartao-local").evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(fonte, `${onde}: cartão 16/600`).toBe(16);
  // Adendo: no máximo 1 selo, em pill branca.
  const selos = cartao.getByTestId("selos-foto").locator(":scope > *");
  expect(await selos.count(), `${onde}: no máximo 1 selo`).toBeLessThanOrEqual(1);
  if (await selos.count()) expect((await estilo(selos.first())).fundo).toBe(BRANCO);
  // Adendo: ordem bairro + nota → título (até 2 linhas) → total → síntese → disponibilidade (de cima para baixo).
  const ys: number[] = [];
  for (const id of ["cartao-local", "cartao-titulo", "cartao-total-mes", "cartao-sintese", "cartao-disponivel"]) {
    const el = cartao.getByTestId(id);
    if (await el.count()) ys.push((await el.boundingBox())!.y);
  }
  expect(ys, `${onde}: ordem do cartão`).toEqual([...ys].sort((a, b) => a - b));
  const linhasTitulo = await cartao.getByTestId("cartao-titulo").evaluate((el) => Math.round(el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight)));
  expect(linhasTitulo, `${onde}: título em até 2 linhas`).toBeLessThanOrEqual(2);
  // "R$ Y em N meses" só com N ≥ 2 (com N = 1, só "R$ X/mês").
  if (await cartao.getByTestId("cartao-total-estadia").count()) await expect(cartao.getByTestId("cartao-total-estadia")).toHaveText(/·\s*R\$\s?[\d.,]+ em \d+ meses/);
  await expect(cartao.getByTestId("cartao-sintese")).toContainText(/\d+ quartos?/);
  expect((await estilo(cartao.getByTestId("cartao-titulo"))).cor, `${onde}: texto secundário #3F3F3F`).toBe(SECUNDARIO);
}

/** Primário: 52 px no celular, 56 px no computador, raio 8, fundo verde, texto branco, sem sombra. */
async function conferirPrimario(botao: Locator, largura: number, onde: string) {
  const e = await estilo(botao);
  expect(e.altura, `${onde}: altura do primário`).toBe(largura >= 1024 ? 56 : 52);
  expect(e.raio, `${onde}: raio 8`).toBe("8px");
  expect(e.fundo, `${onde}: fundo verde`).toBe(VERDE);
  expect(e.cor, `${onde}: texto branco`).toBe(BRANCO);
  expect(e.peso).toBe("600");
}

async function idsNoAr(request: APIRequestContext): Promise<string[]> {
  const api = (await (await request.get("/api/properties")).json()) as unknown;
  const lista = (Array.isArray(api) ? api : ((api as { properties?: unknown[] }).properties ?? [])) as { id: string }[];
  return lista.map((p) => p.id);
}

/** Favoritos guardados no aparelho (visitante), no formato do store (zustand persist). */
async function comFavoritos(page: Page, ids: string[]) {
  await page.addInitScript((lista) => {
    localStorage.setItem("vivanomads-favorites", JSON.stringify({ state: { owner: null, ids: lista }, version: 0 }));
  }, ids);
}

/** Total da busca lido do h1 ("38 imóveis…"); "Nenhum" = 0. */
async function totalDoTitulo(page: Page): Promise<number> {
  const t = await page.getByTestId("titulo-busca").innerText();
  return Number(t.match(/^\d+/)?.[0] ?? 0);
}

/** Abre a folha de filtros: no celular pelo botão redondo; no computador pela busca compacta → "Mais filtros". */
async function abrirFolha(page: Page, largura: number): Promise<Locator> {
  if (largura < 1024) {
    await page.getByTestId("abrir-filtros").click();
  } else {
    if ((await page.getByTestId("filtros-barra").getAttribute("data-aberto")) !== "1") await page.getByTestId("busca-compacta").click();
    await page.getByTestId("mais-filtros").click();
  }
  const folha = page.getByRole("dialog", { name: "Filtros" });
  await expect(folha).toBeVisible();
  return folha;
}

test.describe("T244 — Fundação visual (Prompt 40)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: 120_000 });

  for (const largura of LARGURAS) {
    test.describe(`${largura} px`, () => {
      test.use({ viewport: { width: largura, height: altura(largura) } });

      test("1. home: cartões sem caixa, foto 4:3 com raio 12; busca em pill; primário 52/56", async ({ page }) => {
        semDialogo(page);
        await page.goto("/", { waitUntil: "networkidle" });
        const barra = await estilo(page.getByTestId("barra-busca-home"));
        expect(Number.parseFloat(barra.raio), "busca da home em pill").toBeGreaterThanOrEqual(28);
        const destaques = page.getByTestId("destaques-home");
        test.skip((await destaques.count()) === 0, "Home sem destaques nesta base.");
        await destaques.scrollIntoViewIfNeeded();
        const cartoes = destaques.getByTestId("cartao-imovel");
        expect(await cartoes.count()).toBeGreaterThan(0);
        for (let i = 0; i < Math.min(2, await cartoes.count()); i++) await conferirCartao(cartoes.nth(i), `home cartão ${i + 1}`);
        await destaques.screenshot({ path: `${SAIDA}/t244-home-cartoes-${largura}.png` });
        await conferirPrimario(page.getByRole("link", { name: /Quero anunciar meu imóvel/ }), largura, "home: Quero anunciar");
        await semRolagemLateral(page);
      });

      test("2. /buscar: barra em pill, chips com contorno (selecionado = tinta), folha com a contagem ao vivo", async ({ page }) => {
        semDialogo(page);
        await page.goto("/buscar?exemplos=1", { waitUntil: "networkidle" });
        const barra = page.getByTestId(largura < 1024 ? "barra-busca" : "busca-compacta");
        await expect(barra).toBeVisible();
        expect(Number.parseFloat((await estilo(barra)).raio), "barra de busca em pill").toBeGreaterThanOrEqual(20);
        await barra.screenshot({ path: `${SAIDA}/t244-buscar-barra-${largura}.png` });

        const cartoes = page.getByTestId("cartao-imovel");
        await expect(cartoes.first()).toBeVisible();
        await conferirCartao(cartoes.first(), "/buscar");

        const folha = await abrirFolha(page, largura);
        const caixa = (await folha.boundingBox())!;
        if (largura < 1024) {
          // De baixo para cima: encostada no rodapé da tela, largura toda.
          expect(Math.round(caixa.y + caixa.height)).toBeGreaterThanOrEqual(altura(largura) - 1);
          expect(Math.round(caixa.width)).toBe(largura);
        } else {
          // Painel lateral à direita, altura toda.
          expect(Math.round(caixa.x + caixa.width)).toBe(largura);
          expect(Math.round(caixa.height)).toBe(altura(largura));
          expect(caixa.width).toBeLessThanOrEqual(460);
        }
        const chip = folha.getByRole("button", { name: "Aceita pets", exact: true });
        const antes = await estilo(chip);
        expect(Number.parseFloat(antes.raio), "chip em pill").toBeGreaterThanOrEqual(20);
        expect(antes.borda).toBe("1px");
        expect(antes.fundo).toBe(BRANCO);
        await expect(chip).toHaveAttribute("aria-pressed", "false");
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        const depois = await estilo(chip);
        expect(depois.fundo, "chip selecionado = fundo tinta").toBe(TINTA);
        expect(depois.cor, "chip selecionado = texto branco").toBe(BRANCO);

        const aplicar = folha.getByTestId("aplicar-filtros");
        await expect(aplicar).toHaveText(/^(Mostrar \d+ imóve(l|is)|Nenhum imóvel com esses filtros)$/);
        await conferirPrimario(aplicar, largura, "folha: Mostrar N imóveis");
        const limpar = await estilo(folha.getByTestId("limpar-tudo"));
        expect(limpar.sublinhado, "Limpar tudo é terciário (sublinhado)").toContain("underline");
        expect(limpar.fundo).toBe("rgba(0, 0, 0, 0)");
        for (const proibido of ["Ambos", "Indiferente", "Tanto faz", "Qualquer"]) await expect(folha.getByRole("button", { name: proibido, exact: true })).toHaveCount(0);
        await page.screenshot({ path: `${SAIDA}/t244-buscar-folha-${largura}.png` });
        await folha.getByTestId("painel-tipo").screenshot({ path: `${SAIDA}/t244-buscar-chips-${largura}.png` });
        await semRolagemLateral(page);
      });

      test("2b. folha: a contagem do botão = itens da lista; Limpar tudo zera", async ({ page }) => {
        semDialogo(page);
        await page.goto("/buscar", { waitUntil: "networkidle" });
        const total = await totalDoTitulo(page);
        test.skip(total === 0, "Busca vazia nesta base.");

        let folha = await abrirFolha(page, largura);
        const aplicar = folha.getByTestId("aplicar-filtros");
        await expect(aplicar).toHaveAttribute("data-total", String(total));
        // Uma escolha que filtra de verdade (0 < n), tentando da mais seletiva para a menos.
        let n = 0;
        const quartos = folha.locator("fieldset", { hasText: "Quartos" });
        for (const rotulo of ["3+", "2+", "1+"]) {
          await quartos.getByRole("button", { name: rotulo, exact: true }).click();
          n = Number(await aplicar.getAttribute("data-total"));
          if (n > 0) break;
        }
        test.skip(n === 0, "Nenhum imóvel com quartos informados nesta base.");
        await expect(aplicar).toHaveText(`Mostrar ${n} ${n === 1 ? "imóvel" : "imóveis"}`);
        await aplicar.click();
        await expect(folha).toHaveCount(0);
        await expect(page.getByTestId("card-resultado"), "contagem do botão = itens da lista").toHaveCount(n);
        expect(await totalDoTitulo(page)).toBe(n);
        await expect(page).toHaveURL(/quartos=\d/);

        folha = await abrirFolha(page, largura);
        expect(await folha.locator('[aria-pressed="true"]').count()).toBeGreaterThan(0);
        await folha.getByTestId("limpar-tudo").click();
        await expect(folha.locator('[aria-pressed="true"]'), "Limpar tudo desliga todos os chips").toHaveCount(0);
        await expect(folha.getByTestId("aplicar-filtros"), "Limpar tudo volta ao total").toHaveAttribute("data-total", String(total));
        await page.screenshot({ path: `${SAIDA}/t244-buscar-limpar-tudo-${largura}.png` });
        await folha.getByTestId("aplicar-filtros").click();
        await expect(page.getByTestId("card-resultado")).toHaveCount(total);
        await expect(page).not.toHaveURL(/quartos=/);
      });

      test("3. favoritos: o mesmo cartão (e o esqueleto com rede lenta)", async ({ page, request }) => {
        semDialogo(page);
        const ids = (await idsNoAr(request)).slice(0, 2);
        test.skip(ids.length === 0, "Sem anúncio no ar nesta base.");
        await comFavoritos(page, ids);
        // Rede lenta: a lista de imóveis demora 3 s — no lugar, o esqueleto no formato do cartão.
        await page.route("**/api/properties*", async (route) => {
          await new Promise((r) => setTimeout(r, 3_000));
          await route.continue();
        });
        await page.goto("/favoritos", { waitUntil: "domcontentloaded" });
        const esqueleto = page.getByTestId("skeleton-cartao");
        await expect(esqueleto.first()).toBeVisible();
        expect(await esqueleto.count()).toBe(ids.length);
        const bloco = await estilo(esqueleto.first().locator("div").first());
        expect(bloco.raio, "esqueleto: foto com raio 12").toBe("12px");
        expect(Math.abs(bloco.largura / bloco.altura - 4 / 3), "esqueleto: foto 4:3").toBeLessThan(0.03);
        expect(bloco.fundo, "esqueleto cinza (divisor)").toBe("rgb(235, 235, 235)");
        await page.screenshot({ path: `${SAIDA}/t244-skeleton-favoritos-${largura}.png` });

        await expect(page.getByTestId("favoritos-grade")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
        const cartoes = page.getByTestId("favoritos-grade").getByTestId("cartao-imovel");
        await expect(cartoes.first()).toBeVisible();
        await conferirCartao(cartoes.first(), "favoritos");
        await page.screenshot({ path: `${SAIDA}/t244-favoritos-${largura}.png`, fullPage: true });
        await semRolagemLateral(page);
      });

      test("4. /cidades/uberlandia: o mesmo cartão, grade par", async ({ page }) => {
        semDialogo(page);
        await page.goto("/cidades/uberlandia", { waitUntil: "networkidle" });
        const grade = page.getByTestId("cidade-imoveis");
        test.skip((await grade.count()) === 0, "Uberlândia sem anúncios nesta base.");
        const cartoes = grade.getByTestId("cartao-imovel");
        await conferirCartao(cartoes.first(), "/cidades/uberlandia");
        const colunas = await grade.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        expect(colunas).toBe(largura >= 1024 ? 4 : 1);
        const secundario = await estilo(page.getByRole("link", { name: "Ver toda a busca" }));
        expect(secundario.raio).toBe("8px");
        expect(secundario.fundo).toBe(BRANCO);
        expect(secundario.corBorda, "secundário: contorno tinta").toBe(TINTA);
        await expect(page.getByText(/em breve/i)).toHaveCount(0);
        await page.screenshot({ path: `${SAIDA}/t244-cidades-uberlandia-${largura}.png` });
        await semRolagemLateral(page);
      });

      test("5. imóveis parecidos na página do imóvel: o mesmo cartão", async ({ page }) => {
        semDialogo(page);
        await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
        const bloco = page.getByTestId("imoveis-parecidos");
        test.skip((await bloco.count()) === 0, "Sem outros anúncios para sugerir nesta base.");
        await bloco.scrollIntoViewIfNeeded();
        const cartoes = bloco.getByTestId("cartao-imovel");
        expect([1, 2, 4]).toContain(await cartoes.count()); // grade par (ou 1 quando só há 1)
        await conferirCartao(cartoes.first(), "imóveis parecidos");
        await bloco.screenshot({ path: `${SAIDA}/t244-imoveis-parecidos-${largura}.png` });
        await semRolagemLateral(page);
      });

      test("6. /buscar com rede lenta: esqueleto no formato do cartão", async ({ page }) => {
        semDialogo(page);
        await page.goto("/", { waitUntil: "networkidle" });
        // Navegação do próprio app até a /buscar com a resposta do servidor atrasada em 3 s (RSC).
        await page.route(
          (url) => url.pathname === "/buscar",
          async (route) => {
            await new Promise((r) => setTimeout(r, 3_000));
            await route.continue();
          }
        );
        await page.getByRole("link", { name: /Ver todos os imóveis/ }).click();
        const carregando = page.getByTestId("buscar-carregando");
        const viu = await carregando
          .waitFor({ state: "visible", timeout: 2_500 })
          .then(() => true)
          .catch(() => false);
        if (viu) {
          const sk = page.getByTestId("skeleton-cartao");
          expect(await sk.count()).toBeGreaterThanOrEqual(2);
          expect((await sk.count()) % 2).toBe(0);
          const foto = await estilo(sk.first().locator("div").first());
          expect(foto.raio).toBe("12px");
          expect(Math.abs(foto.largura / foto.altura - 4 / 3)).toBeLessThan(0.03);
          await page.screenshot({ path: `${SAIDA}/t244-skeleton-buscar-${largura}.png` });
        } else {
          // A rota já estava pré-carregada inteira: o esqueleto da busca não chega a aparecer (o dos favoritos, linha 3, cobre).
          test.info().annotations.push({ type: "aviso", description: "/buscar pré-carregada: esqueleto não visível nesta navegação" });
        }
        await expect(page.getByTestId("busca")).toBeVisible({ timeout: 30_000 });
      });

      test("7. coração: 1 toque salva, outro desfaz (aria-pressed)", async ({ page }) => {
        semDialogo(page);
        await page.goto("/buscar?exemplos=1", { waitUntil: "networkidle" });
        const cartao = page.getByTestId("cartao-imovel").first();
        const coracao = cartao.getByTestId("coracao");
        const id = (await cartao.locator("a").first().getAttribute("href"))!.replace("/imoveis/", "");
        const guardados = () => page.evaluate(() => JSON.parse(localStorage.getItem("vivanomads-favorites") ?? "{}").state?.ids ?? []);
        await expect(coracao).toHaveAttribute("aria-pressed", "false");
        // O toque antes da hidratação é repetido (como no T160).
        await expect(async () => {
          if ((await coracao.getAttribute("aria-pressed")) !== "true") await coracao.click();
          await expect(coracao).toHaveAttribute("aria-pressed", "true", { timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
        await expect(coracao).toHaveAccessibleName("Remover dos favoritos");
        expect(await guardados()).toContain(id);
        expect(page.url(), "o toque não navega").toContain("/buscar");
        await cartao.screenshot({ path: `${SAIDA}/t244-coracao-salvo-${largura}.png` });
        await coracao.click();
        await expect(coracao).toHaveAttribute("aria-pressed", "false");
        await expect(coracao).toHaveAccessibleName("Adicionar aos favoritos");
        expect(await guardados()).not.toContain(id);
        await cartao.screenshot({ path: `${SAIDA}/t244-coracao-desfeito-${largura}.png` });
      });

      test("8. botões das telas da matriz: altura, raio e cor; uma sombra só (a do flutuante)", async ({ page }) => {
        semDialogo(page);
        // Favoritos vazio: "Explorar imóveis" é o primário.
        await page.goto("/favoritos", { waitUntil: "networkidle" });
        await conferirPrimario(page.getByRole("link", { name: "Explorar imóveis" }), largura, "favoritos: Explorar imóveis");
        // Todos os botões padrão ([data-cta]) da home, da busca e de cidades: raio 8, peso 600, cor do padrão, sem sombra.
        for (const rota of ["/", "/buscar", "/cidades/uberlandia", "/favoritos"]) {
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          await page.locator("[data-cta]").first().waitFor({ state: "attached", timeout: 15_000 }).catch(() => undefined);
          const lista = await page.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLElement>("[data-cta]"))
              .filter((el) => el.getBoundingClientRect().width > 0 && !el.closest('[data-testid="fale-com-a-viva-raiz"]'))
              .map((el) => {
                const cs = getComputedStyle(el);
                return { txt: (el.textContent ?? "").trim().slice(0, 30), raio: cs.borderTopLeftRadius, peso: cs.fontWeight, fundo: cs.backgroundColor, sombra: cs.boxShadow, h: Math.round(el.getBoundingClientRect().height) };
              })
          );
          for (const b of lista) {
            expect(b.raio, `${rota} "${b.txt}"`).toBe("8px");
            expect(b.peso, `${rota} "${b.txt}"`).toBe("600");
            expect([VERDE, BRANCO, "rgba(0, 0, 0, 0)"], `${rota} "${b.txt}"`).toContain(b.fundo);
            expect(b.sombra, `${rota} "${b.txt}" sem sombra`).toBe("none");
          }
        }
        // O flutuante "Fale com a Viva" é o único com sombra.
        const flut = page.getByTestId("fale-com-a-viva");
        if (await flut.isVisible()) expect((await estilo(flut)).sombra).not.toBe("none");
        await page.goto("/", { waitUntil: "networkidle" });
        await page.getByRole("link", { name: /Quero anunciar meu imóvel/ }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SAIDA}/t244-botoes-${largura}.png` });
      });

      test("9. adendo: carrossel com pontos, cinzas do texto corrido e sombra só no que flutua", async ({ page }) => {
        semDialogo(page);
        await page.goto("/buscar?exemplos=1", { waitUntil: "networkidle" });
        const cartoes = page.getByTestId("cartao-imovel");
        await expect(cartoes.first()).toBeVisible();
        // Carrossel: o cartão com mais de 1 foto mostra os pontos (o 1º aceso) e desliza.
        const comPontos = cartoes.filter({ has: page.getByTestId("cartao-pontos") }).first();
        if (await comPontos.count()) {
          await expect(comPontos.getByTestId("cartao-pontos").locator('[data-ativo="1"]')).toHaveCount(1);
          await comPontos.locator("[data-fotos]").evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
          await expect(comPontos.getByTestId("cartao-pontos").locator("span").nth(1)).toHaveAttribute("data-ativo", "1");
          await comPontos.screenshot({ path: `${SAIDA}/t244-cartao-carrossel-${largura}.png` });
        } else {
          test.info().annotations.push({ type: "aviso", description: "nenhum cartão com mais de 1 foto nesta base" });
        }
        // Cinzas: miúdo de apoio (#6A6A6A) só com ≤ 14 px; nenhum texto de 16 px+ em #6A6A6A.
        const apoioGrande = await page.evaluate((cor) =>
          Array.from(document.querySelectorAll<HTMLElement>("main p, main span, main h1, main h2, main h3, main li"))
            .filter((el) => el.offsetParent !== null && el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0)
            .filter((el) => getComputedStyle(el).color === cor && Number.parseFloat(getComputedStyle(el).fontSize) > 14)
            .map((el) => (el.textContent ?? "").trim().slice(0, 30)),
        APOIO);
        expect(apoioGrande, "cinza de apoio só em miúdo").toEqual([]);
        // Sombra: o cartão, a barra de busca e os chips não têm; o flutuante tem.
        expect((await estilo(cartoes.first().locator("a").first())).sombra).toBe("none");
        const flut = page.getByTestId("fale-com-a-viva");
        if (await flut.isVisible()) expect((await estilo(flut)).sombra).not.toBe("none");
        if (largura >= 1024) {
          await page.getByTestId("busca-compacta").click();
          expect((await estilo(page.getByTestId("filtros-barra"))).sombra, "faixa de filtros presa (busca fixa)").not.toBe("none");
          const pino = page.getByTestId("pin-mapa").first();
          if (await pino.isVisible().catch(() => false)) expect((await estilo(pino)).sombra, "botão do mapa").not.toBe("none");
          await page.keyboard.press("Escape");
        }
        await page.mouse.wheel(0, 800);
        await expect.poll(async () => (await estilo(page.locator("header").first())).sombra, { message: "cabeçalho fixo ao rolar" }).not.toBe("none");
        await page.screenshot({ path: `${SAIDA}/t244-sombra-flutuantes-${largura}.png` });
      });
    });
  }
});
