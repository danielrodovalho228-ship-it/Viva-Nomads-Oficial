import { test, expect, type Page } from "@playwright/test";

/*
  T2082 — Família 4, E910 · E911 · E912 · E913 · E914 (Pista 3; auditoria das travas, ronda 04:55Z)
  @E910 @E911 @E912 @E913 @E914 @ao-vivo-seguro
  As regras decididas (correção no draft #3883) que se veem de fora, como visitante; o #3883 só traz testes de fonte.
    - E910: em /parceiros, o cartão "Gestores e administradoras" ganha a ligação "Pedir parceria"
      (/parceiros?categoria=outro#quero-ser-parceiro), DEPOIS da ligação das taxas, que segue em primeiro.
    - E911: /parceiros/fotografos abre com foto (o banner do topo, como as irmãs); o h1 segue "Fotógrafos parceiros".
    - E912: o tema da Ajuda abre com a sua foto, e cada "Outro tema" tem a miniatura do seu cartão.
    - E913: no rodapé preto o símbolo da marca assenta direto no fundo, sem a placa branca.
    - E914: em /parceiros/avaliadores, a grade "Como funciona" é 2+2 a 1280 px (nunca 3+1).
  Vermelha na main até a correção entrar. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

/** Imagem real e carregada dentro do localizador. */
async function temFoto(page: Page, sel: ReturnType<Page["locator"]>, rotulo: string) {
  const img = sel.locator("img").first();
  await expect(img, `${rotulo}: tem foto`).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { message: `${rotulo}: a foto carregou`, timeout: 20_000 }).toBe(true);
}

test("T2082 — E910: o cartão Gestores e administradoras tem Pedir parceria depois das taxas @E910 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const cartao = page.getByTestId("parceiros-tipos").locator("li").filter({ has: page.getByRole("heading", { name: "Gestores e administradoras", exact: true }) });
  await expect(cartao).toHaveCount(1, { timeout: 30_000 });
  const ligacoes = await cartao.locator("a").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), texto: (a.textContent ?? "").trim() })));
  const iParceria = ligacoes.findIndex((l) => l.texto === "Pedir parceria");
  expect(iParceria, `ligações do cartão: ${JSON.stringify(ligacoes)}`).toBeGreaterThan(0);
  expect(ligacoes[iParceria].href).toBe("/parceiros?categoria=outro#quero-ser-parceiro");
  expect(ligacoes[0].texto, "a ligação das taxas segue em primeiro").toMatch(/taxa|Plano Gestor/i);
});

test("T2082 — E911: /parceiros/fotografos abre com foto e o h1 segue Fotógrafos parceiros @E911 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros/fotografos", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Fotógrafos parceiros" })).toBeVisible({ timeout: 30_000 });
  // A foto do topo vem ANTES do h1 na página (o banner abre a página).
  const h1 = page.getByRole("heading", { level: 1 });
  const topo = page.locator("main img").first();
  await temFoto(page, page.locator("main"), "topo de /parceiros/fotografos");
  const [yFoto, yH1] = [await topo.evaluate((e) => e.getBoundingClientRect().top), await h1.evaluate((e) => e.getBoundingClientRect().top)];
  expect(yFoto, "a página abre com a foto (no topo, junto do h1)").toBeLessThanOrEqual(yH1 + 1);
});

for (const tema of ["morador", "proprietarios", "contratos", "seguranca"]) {
  test(`T2082 — E912: /ajuda/${tema} abre com a sua foto e cada Outro tema tem miniatura @E912 @ao-vivo-seguro`, async ({ page }) => {
    const r = await page.goto(`/ajuda/${tema}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const cabecalho = page.getByTestId("ajuda-tema-pagina").locator("header").first();
    await expect(cabecalho).toBeVisible({ timeout: 30_000 });
    await temFoto(page, cabecalho, `/ajuda/${tema}: foto do tema`);
    const outros = page.locator('[data-testid^="ajuda-outro-tema-"]');
    const n = await outros.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await temFoto(page, outros.nth(i), `outro tema ${i + 1}`);
  });
}

test("T2082 — E913: no rodapé preto o símbolo da marca não tem a placa branca @E913 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const rodape = page.locator("footer").last();
  await rodape.scrollIntoViewIfNeeded();
  const simbolo = rodape.locator('img[src*="vn-mark"]').first();
  await expect(simbolo).toBeAttached({ timeout: 30_000 });
  // Do símbolo até o rodapé, nenhum ancestral com fundo branco (a "placa").
  const placa = await simbolo.evaluate((img) => {
    const fim = img.closest("footer");
    for (let e = img.parentElement; e && e !== fim; e = e.parentElement) {
      const bg = getComputedStyle(e).backgroundColor;
      if (/^rgba?\(255, 255, 255(, 1)?\)$/.test(bg)) return `<${e.tagName.toLowerCase()} class="${e.className}">`;
    }
    return null;
  });
  expect(placa, "o símbolo do rodapé está numa placa branca").toBeNull();
});

test("T2082 — E914: a 1280 px a grade Como funciona de /parceiros/avaliadores é 2+2 @E914 @ao-vivo-seguro", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const r = await page.goto("/parceiros/avaliadores", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const titulo = page.getByRole("heading", { name: "Como funciona", exact: true });
  await expect(titulo).toBeVisible({ timeout: 30_000 });
  const itens = titulo.locator("xpath=following-sibling::ul[1]").locator(":scope > li");
  await expect(itens).toHaveCount(4);
  const topos = await itens.evaluateAll((lis) => lis.map((l) => Math.round(l.getBoundingClientRect().top)));
  const linhas = [...new Set(topos)].sort((a, b) => a - b);
  expect(linhas.length, `topos dos 4 passos: ${topos.join(", ")}`).toBe(2);
  expect(topos.filter((t) => t === linhas[0]).length, "2 passos na 1ª linha").toBe(2);
  expect(topos.filter((t) => t === linhas[1]).length, "2 passos na 2ª linha").toBe(2);
});
