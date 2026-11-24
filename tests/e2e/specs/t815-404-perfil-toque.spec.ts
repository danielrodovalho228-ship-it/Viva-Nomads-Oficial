import { test, expect, type Page } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";

/*
  T815 — varredura 02/11 (Pista A): 404 e perfil do proprietário. E960: o logo da 404 é o do Navbar padrão (E916).
  1. 404: logo e "É proprietário? Anuncie seu imóvel →" com alvo de 44 px no toque (390).
  2. 404 a 768 (2 colunas): 2 destaques, mesma largura, sem buraco; a 1280 (3 colunas), os três lado a lado.
  3. Perfil de exemplo do proprietário: "· N avaliações" com alvo de 44 px no toque.
*/
const SAIDA = "tests/laboratorio/saida";
/** E1033: a área de toque REAL (9 pontos da caixa 44×44 com elementFromPoint), não a altura do ::after. */
const alvo = async (p: Page, sel: string) => (await areaDeToque(p.locator(sel).first())).faltam;

/*
  E960, devolução de 19/11 (até ao E1033; o `alvo` acima mede agora a área REAL): o `alvo` aceitava a área do ::after da classe `alvo-toque`, que só existe em tela de
  toque. Por isso o caso do logo passava com a âncora a 32 px, e em produção o Gerente mediu 153 × 32 px.
  Daqui em diante mede-se o retângulo da PRÓPRIA âncora do logo do cabeçalho público (o elemento que se clica).
*/
const ancoraDoLogo = (p: Page) => p.getByTestId("topo-publico").getByRole("link", { name: "VivaNomads — página inicial" });
const medirAncoraDoLogo = (p: Page) =>
  ancoraDoLogo(p).evaluate((e) => {
    const r = e.getBoundingClientRect();
    const i = e.querySelector("img")!.getBoundingClientRect();
    const n = e.closest("nav")!.getBoundingClientRect();
    return { tag: e.tagName, href: e.getAttribute("href"), altura: r.height, topo: r.top, base: r.bottom, simbolo: i.height, meioDaAncora: r.top + r.height / 2, meioDoSimbolo: i.top + i.height / 2, barraTopo: n.top, barraBase: n.bottom };
  });

test.describe("T815 — toque a 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("404: logo (E960) e link de anunciar com 44 px", async ({ page }) => {
    const r = await page.goto("/pagina-que-nao-existe-t815", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await expect(page.getByTestId("nao-encontrada-anunciar")).toBeVisible({ timeout: 30_000 });
    expect(await alvo(page, '[data-testid="nao-encontrada-anunciar"]')).toEqual([]);
    expect(await alvo(page, "header [data-logo]")).toEqual([]);
    // E960 (devolução): o retângulo da própria âncora, não a área do ::after.
    expect((await medirAncoraDoLogo(page)).altura, "altura do retângulo da âncora do logo").toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t815-404-390.png`, fullPage: true });
  });
  test("perfil de exemplo: link das avaliações com 44 px", async ({ page }) => {
    const r = await page.goto("/proprietario/exemplo-1", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o proprietário de exemplo neste ambiente.");
    await expect(page.getByTestId("perfil-link-avaliacoes")).toBeVisible({ timeout: 30_000 });
    expect(await alvo(page, '[data-testid="perfil-link-avaliacoes"]')).toEqual([]);
  });
});

for (const [largura, visiveis] of [[768, 2], [1280, 3]] as const) {
  test(`T815 — 404 a ${largura} px: destaques em grade par`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/pagina-que-nao-existe-t815", { waitUntil: "domcontentloaded" });
    // E961: os destaques chegam pelo cliente; espera a vitrine assentar (pronto ou vazio) antes de decidir pular.
    await expect(page.getByTestId("nao-encontrada-vitrine")).not.toHaveAttribute("data-estado", "carregando", { timeout: 30_000 });
    const grade = page.getByTestId("nao-encontrada-destaques");
    test.skip((await grade.count()) === 0 || (await grade.locator(":scope > *").count()) < 3, "Sem 3 imóveis em destaque neste ambiente.");
    // Todos os visíveis com a mesma largura (cartões uniformes) e nenhum buraco: 2 em 2 colunas, 3 em 3.
    const larguras = await grade.locator(":scope > *").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width).filter((w) => w > 0));
    expect(larguras).toHaveLength(visiveis);
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t815-404-${largura}.png`, fullPage: true });
  });
}


// E960 (devolução de 19/11): a âncora do logo do cabeçalho público tem 44 px de altura nela própria, com toque ou com
// rato, na página inicial (onde o Gerente mediu) e na 404. O desenho não muda: o símbolo segue com 32 px, centrado.
for (const [nome, opcoes] of [
  ["390 px com toque", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ["1280 px com rato", { viewport: { width: 1280, height: 900 } }],
] as const) {
  test.describe(`T815 — E960: âncora do logo do cabeçalho público a ${nome}`, () => {
    test.use(opcoes);
    for (const [tela, rota] of [["página inicial", "/"], ["404", "/pagina-que-nao-existe-t815"]] as const) {
      test(`${tela}: o retângulo da âncora tem 44 px de altura e o símbolo fica onde estava`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(ancoraDoLogo(page)).toBeVisible({ timeout: 30_000 });
        const m = await medirAncoraDoLogo(page);
        expect(m.tag, "o que se mede é o link").toBe("A");
        expect(m.href).toBe("/");
        expect(m.altura, "altura do retângulo da âncora do logo").toBeGreaterThanOrEqual(44);
        expect(m.simbolo, "o símbolo continua com 32 px").toBe(32);
        expect(Math.abs(m.meioDaAncora - m.meioDoSimbolo), "o símbolo fica centrado na âncora").toBeLessThanOrEqual(1);
        expect(m.topo, "a âncora não sai por cima da barra").toBeGreaterThanOrEqual(m.barraTopo);
        expect(m.base, "a âncora não sai por baixo da barra").toBeLessThanOrEqual(m.barraBase);
      });
    }
  });
}
