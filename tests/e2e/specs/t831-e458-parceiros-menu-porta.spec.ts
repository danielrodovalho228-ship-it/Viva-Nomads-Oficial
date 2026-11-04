import { test, expect, type Page } from "@playwright/test";

/*
  T831 — E458 (Relay 58, spec do coordenador validada em 02/11): "Parceiros" no menu público e a porta com dois caminhos.
  - O menu público tem EXATAMENTE os 5 destinos, nesta ordem, no computador e no celular:
    Imóveis · Anunciar · Empresas · Parceiros · Fale com a Viva.
  - No computador o topo cabe numa linha só em 1024, 1280 e 1536 px.
  - /parceiros mostra, antes do conteúdo, "Encontrar um parceiro" (→ /parceiros/buscar) e "Quero ser parceiro" (→ o
    cadastro na própria página): lado a lado no computador, empilhados no celular.
  - /parceiros/buscar tem a linha "É profissional? Seja parceiro da Viva" (→ /parceiros); o rodapé mantém "Parceiros".
*/
const SAIDA = "tests/laboratorio/saida";
const DESTINOS = [
  ["Imóveis", "/buscar"],
  ["Anunciar", "/dashboard/imoveis/novo"],
  ["Empresas", "/empresas"],
  ["Parceiros", "/parceiros"],
  ["Planos", "/planos"], // E555
  ["Fale com a Viva", "/ajuda/fale-com-a-viva"],
];

async function linksDoMenu(page: Page, largura: number) {
  const topo = page.getByTestId("topo-publico");
  if (largura < 1024) {
    await topo.getByTestId("nav-menu").click();
    const lista = page.getByTestId("nav-menu-lista");
    const links = lista.getByRole("link").filter({ hasNotText: /^Entrar$|^Meu painel/ });
    return links;
  }
  return topo.locator('[data-testid="nav-links"] a, [data-testid="nav-fale-com-a-viva"]');
}

for (const largura of [390, 1280] as const) {
  test.describe(`T831 — E458 a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("menu público: exatamente os 5 destinos, na ordem", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const links = await linksDoMenu(page, largura);
      await expect(links).toHaveText(DESTINOS.map((d) => d[0]));
      for (const [i, [, href]] of DESTINOS.entries()) await expect(links.nth(i)).toHaveAttribute("href", href);
      await page.screenshot({ path: `${SAIDA}/t831-menu-${largura}.png` });
    });

    test("/parceiros: os dois caminhos no topo, com os destinos certos; a busca aponta de volta", async ({ page }) => {
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const porta = page.getByTestId("parceiros-porta");
      const encontrar = porta.getByRole("link", { name: "Encontrar um parceiro" });
      const ser = porta.getByRole("link", { name: "Quero ser parceiro" });
      await expect(encontrar).toHaveAttribute("href", "/parceiros/buscar");
      await expect(ser).toHaveAttribute("href", "#quero-ser-parceiro");
      await expect(page.locator("#quero-ser-parceiro")).toHaveCount(1);
      const a = (await encontrar.boundingBox())!;
      const b = (await ser.boundingBox())!;
      if (largura === 390) expect(b.y).toBeGreaterThan(a.y + a.height - 1); // empilhados
      else expect(Math.abs(a.y - b.y)).toBeLessThan(2); // lado a lado
      // Antes do conteúdo de sempre (o banner do topo).
      const banner = (await page.getByRole("heading", { level: 1, name: "Seja parceiro da Viva Nomads" }).boundingBox())!;
      expect(a.y).toBeLessThan(banner.y);
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t831-parceiros-${largura}.png` });

      await ser.click();
      await expect(page).toHaveURL(/\/parceiros#quero-ser-parceiro$/);
      await expect(page.locator("footer").getByRole("link", { name: "Parceiros", exact: true })).toHaveAttribute("href", "/parceiros");

      await page.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
      const linha = page.getByTestId("buscar-seja-parceiro");
      await expect(linha).toContainText("É profissional? Seja parceiro da Viva");
      await expect(linha.getByRole("link", { name: "Seja parceiro da Viva" })).toHaveAttribute("href", "/parceiros");
      await page.screenshot({ path: `${SAIDA}/t831-buscar-${largura}.png` });
    });
  });
}

test.describe("T831 — topo do computador numa linha só", () => {
  for (const largura of [1024, 1280, 1536] as const) {
    test(`${largura} px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const links = await linksDoMenu(page, largura);
      await expect(links).toHaveCount(DESTINOS.length); // E555: 6 destinos
      // Cada destino numa linha só e todos na mesma altura (nada quebra nem desce).
      const caixas = await links.evaluateAll((els) => els.map((e) => ({ topo: Math.round(e.getBoundingClientRect().top), linhas: e.getClientRects().length, alto: e.getBoundingClientRect().height })));
      for (const c of caixas) expect(c.linhas, JSON.stringify(caixas)).toBe(1);
      expect(new Set(caixas.map((c) => c.topo)).size, JSON.stringify(caixas)).toBe(1);
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await page.getByTestId("topo-publico").screenshot({ path: `${SAIDA}/t831-topo-${largura}.png` });
    });
  }
});
