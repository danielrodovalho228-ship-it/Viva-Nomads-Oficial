import { test, expect } from "@playwright/test";

/*
  T2046 — E323 (Pista 3, cobertura do mapa das 142; aprovado na ORDEM-DUET-073) @E323 @ao-vivo-seguro
  Regra: a foto nunca fica em branco — se a versão otimizada falha, a imagem tenta UMA vez direto da origem; se falhar
  de novo, aparece "Foto indisponível" (nunca o quadro vazio carregando para sempre).
  Visitante, só leitura: a falha é simulada no próprio navegador do teste (page.route), nada muda no site.
*/
test.use({ storageState: { cookies: [], origins: [] } });

async function primeiroAnuncio(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  const a = page.locator('a[href^="/imoveis/"]').first();
  await expect(a).toBeVisible({ timeout: 30_000 });
  return (await a.getAttribute("href"))!;
}

test.describe("T2046 — E323: a foto nunca fica em branco @E323 @ao-vivo-seguro", () => {
  test("otimizada falha → tenta direto e mostra a foto", async ({ page }) => {
    const href = await primeiroAnuncio(page);
    await page.route("**/_next/image**", (r) => r.abort("failed"));
    await page.goto(href, { waitUntil: "domcontentloaded" });
    const foto = page.locator("[data-foto-estado]").first();
    await expect(foto).toHaveAttribute("data-foto-estado", "pronta", { timeout: 30_000 });
    await expect(foto.locator('img[data-tentativa="direta"]')).toHaveCount(1);
  });

  test("otimizada e direta falham → 'Foto indisponível', nunca o quadro vazio", async ({ page }) => {
    const href = await primeiroAnuncio(page);
    await page.route("**/*", (r) => (r.request().resourceType() === "image" ? r.abort("failed") : r.continue()));
    await page.goto(href, { waitUntil: "domcontentloaded" });
    const foto = page.locator("[data-foto-estado]").first();
    await expect(foto).toHaveAttribute("data-foto-estado", "falhou", { timeout: 30_000 });
    await expect(foto.getByTestId("foto-indisponivel")).toContainText("Foto indisponível");
    await expect(foto.locator("img")).toHaveCount(0);
  });
});
