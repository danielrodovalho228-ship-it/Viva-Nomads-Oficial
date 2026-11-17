import { test, expect, type Page } from "@playwright/test";

/*
  T2052 — E631 (Pista 3, cobertura do mapa das 142; autorizado pelo Gerente em 16/11) @E631 @ao-vivo-seguro
  Regra: "N imóveis na Viva" é o MESMO número no cartão do proprietário (página do anúncio), no perfil público dele e na
  lista de imóveis desse perfil — as três saem da mesma lista pública (antes o perfil dizia 0 e o cartão 10).
  Visitante, só leitura: confere os donos dos 3 primeiros anúncios da /buscar.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const contagem = (t: string) => Number(t.match(/(\d+)\s+imóve(?:l|is) na Viva/)?.[1] ?? NaN);

async function anuncios(p: Page): Promise<string[]> {
  await p.goto("/buscar", { waitUntil: "domcontentloaded" });
  await expect(p.locator('a[href^="/imoveis/"]').first()).toBeVisible({ timeout: 30_000 });
  return [...new Set(await p.locator('a[href^="/imoveis/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!).filter((h) => /^\/imoveis\/[^/?#]+$/.test(h))))].slice(0, 3);
}

test.describe("T2052 — E631: o mesmo número de imóveis na Viva no cartão, no perfil e na lista @E631 @ao-vivo-seguro", () => {
  test("cartão do dono = perfil público = imóveis listados no perfil", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    let conferidos = 0;
    for (const href of await anuncios(page)) {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      const sobre = page.getByTestId("sobre-proprietario");
      await expect(sobre).toBeVisible({ timeout: 30_000 });
      const noCartao = contagem(await sobre.innerText());
      const perfil = sobre.getByRole("link", { name: "Ver perfil completo" });
      if (Number.isNaN(noCartao) || !(await perfil.count())) continue;
      await page.goto((await perfil.getAttribute("href"))!, { waitUntil: "domcontentloaded" });
      const pagina = page.getByTestId("pagina-proprietario");
      await expect(pagina).toBeVisible({ timeout: 30_000 });
      const noPerfil = contagem(await pagina.innerText());
      const lista = page.locator('section[aria-labelledby="imoveis-proprietario"]');
      const listados = new Set(await lista.locator('a[href^="/imoveis/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split(/[?#]/)[0]))).size;
      expect(noPerfil, `${href}: perfil × cartão`).toBe(noCartao);
      expect(listados, `${href}: imóveis listados no perfil × contagem`).toBe(noPerfil);
      conferidos++;
    }
    expect(conferidos, "ao menos um dono com cartão e perfil para conferir").toBeGreaterThan(0);
  });
});
