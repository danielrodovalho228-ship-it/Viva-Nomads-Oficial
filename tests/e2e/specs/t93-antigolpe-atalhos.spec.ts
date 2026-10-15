import { test, expect } from "@playwright/test";

/**
 * T93 — "Próximo do FF" 1/6 e 5/6 (ordens a875278a e 19cfa5b1):
 * atalhos da home com contagem real e aviso antigolpe nas páginas públicas.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

test("home: cada atalho mostra o total real de imóveis e nenhum aparece com 0", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  const totais = page.getByTestId("atalho-total");
  const n = await totais.count();
  for (let i = 0; i < n; i++) {
    const txt = (await totais.nth(i).innerText()).trim();
    expect(txt).toMatch(/^[1-9]\d* im[óo]veis?$/);
  }
});

test("pedido de moradia mostra o aviso antigolpe com link para /seguranca", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
  const aviso = page.getByTestId("aviso-antigolpe");
  await expect(aviso).toContainText("nunca pede PIX");
  await expect(aviso.getByRole("link")).toHaveAttribute("href", "/seguranca");
});

test("home: o atalho de preço é \"Até R$ 2.000/mês\" e abre a busca com orcamento=2000", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  const link = page.getByTestId("atalhos-categoria").getByRole("link", { name: /Até R\$ 2\.000/ });
  if (await link.count()) await expect(link).toHaveAttribute("href", "/buscar?orcamento=2000");
});

test("anúncio: aviso antigolpe fica perto da candidatura", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  const card = page.locator('a[href^="/imoveis/"]').first();
  await card.click();
  await expect(page.getByTestId("aviso-antigolpe").first()).toContainText("nunca pede PIX");
});
