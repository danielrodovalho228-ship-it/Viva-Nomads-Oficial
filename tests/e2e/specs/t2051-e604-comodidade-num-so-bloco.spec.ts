import { test, expect } from "@playwright/test";

/*
  T2051 — E604 (Pista 3, cobertura do mapa das 142; autorizado pelo Gerente em 15/11) @E604 @ao-vivo-seguro
  Regra: na página pública do anúncio, cada item aparece em UM só bloco — o que está nas Comodidades (ex.: Lava-louças,
  TV) não se repete nos Extras do nível. Visitante, só leitura: confere os anúncios da /buscar (até 6).
  Só prova com anúncio que mostre o bloco "Extras": sem nenhum no alvo, diz por que não roda. A regra do catálogo
  (nenhum extra oferecido repete uma comodidade) está em src/config/e604-comodidades-sem-duplicata.test.ts.
  Dúvida registrada no PR: o E604 mantém os extras LEGADOS (Lava-louças, TV) na ficha — um anúncio antigo com TV nas
  comodidades E como extra legado mostraria o item duas vezes; se este spec ficar vermelho por isso, é para o Gerente.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

test.describe("T2051 — E604: comodidade e extra nunca repetem o mesmo item @E604 @ao-vivo-seguro", () => {
  test("nenhum item dos Extras repete uma comodidade do mesmo anúncio", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href^="/imoveis/"]').first()).toBeVisible({ timeout: 30_000 });
    const hrefs = [...new Set(await page.locator('a[href^="/imoveis/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!).filter((h) => /^\/imoveis\/[^/?#]+$/.test(h))))].slice(0, 6);
    let comExtras = 0;
    for (const href of hrefs) {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      // O anúncio abriu (o bloco de comodidades só existe quando o anúncio tem comodidades — sem ele, nada a comparar).
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 });
      const extras = page.getByTestId("nivel-extras");
      if (!(await extras.count())) continue;
      comExtras++;
      const itensExtras = (await extras.locator("dd").innerText()).split(",").map(norm).filter(Boolean);
      const comodidades = new Set((await page.getByTestId("comodidade-item").allInnerTexts()).map(norm));
      const repetidos = itensExtras.filter((e) => comodidades.has(e));
      expect(repetidos, `${href}: itens nos dois blocos`).toEqual([]);
    }
    test.skip(comExtras === 0, "Nenhum anúncio com o bloco Extras neste alvo: a regra só se prova com um.");
  });
});
