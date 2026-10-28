import { test, expect } from "@playwright/test";

/*
  T574 — E207 (decisão do coordenador): o detalhe público do imóvel não tem migalhas visíveis. Quem veio da /buscar vê
  "← Voltar aos resultados", que volta para a mesma busca com os filtros; quem chega direto não vê nada. O
  BreadcrumbList (com a cidade) segue nos dados estruturados. A 390 e 1280 px, visitante.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [1280, 390] as const) {
  test.describe(`T574 — E207 (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });

    test("vindo da busca: '← Voltar aos resultados' volta para a mesma busca", async ({ page }) => {
      await page.goto("/buscar?q=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
      const primeiro = page.locator('main a[href^="/imoveis/"]').first();
      await expect(primeiro).toBeVisible({ timeout: 30_000 });
      const href = await primeiro.getAttribute("href");
      // A /buscar acerta a própria URL ao abrir: vale a URL do momento do clique.
      const busca = new URL(page.url());
      await primeiro.click();
      await page.waitForURL((u) => u.pathname === href?.split("?")[0], { timeout: 30_000 });
      const voltar = page.getByTestId("voltar-resultados");
      await expect(voltar).toHaveText(/Voltar aos resultados/, { timeout: 20_000 });
      await expect(voltar).toHaveAttribute("href", busca.pathname + busca.search);
      await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t574-veio-da-busca-${largura}.png` });
      await voltar.click();
      await page.waitForURL((u) => u.pathname === "/buscar" && u.search === busca.search, { timeout: 30_000 });
    });

    test("chegando direto: sem migalhas e sem voltar; BreadcrumbList nos dados estruturados", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("voltar-resultados")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toHaveCount(0);
      const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
      expect(ld).toContain('"BreadcrumbList"');
      await page.screenshot({ path: `${SAIDA}/t574-direto-${largura}.png` });
    });
  });
}
