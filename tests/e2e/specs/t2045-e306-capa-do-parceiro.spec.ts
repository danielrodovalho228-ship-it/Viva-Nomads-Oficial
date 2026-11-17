import { test, expect } from "@playwright/test";

/*
  T2045 — E306 (Pista 3, cobertura do mapa das 142; aprovado na ORDEM-DUET-073) @E306 @ao-vivo-seguro
  Regra: na busca de parceiros, o cartão de quem não enviou capa mostra uma foto DELE — a 1ª da galeria —, e é a MESMA
  capa da página do parceiro (as duas telas usam capaDoParceiro). Quando a capa vem da galeria, é a 1ª foto da galeria
  da página.
  Visitante, só leitura. Precisa de parceiros publicados no alvo (produção); sem nenhum, o teste diz por que não roda.
  A prova de quebra da regra está no unitário src/lib/data/e306-t2045-capa-do-parceiro-na-busca.test.ts (o alvo local
  em modo demonstração não tem parceiros).
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T2045 — E306: a capa do cartão do parceiro = a da página dele @E306 @ao-vivo-seguro", () => {
  test("até 3 parceiros da busca: mesma capa no cartão e na página; capa de galeria = 1ª foto da galeria", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
    const cartoes = page.getByTestId("cartao-parceiro");
    await page.waitForLoadState("networkidle").catch(() => {});
    const n = await cartoes.count();
    test.skip(n === 0, "Nenhum parceiro publicado neste alvo: a regra só se prova com parceiros (o unitário t2045 prova a quebra).");
    const amostra: { slug: string; origem: string; src: string | null }[] = [];
    for (let i = 0; i < Math.min(3, n); i++) {
      const c = cartoes.nth(i);
      const capa = c.getByTestId("cartao-parceiro-capa");
      amostra.push({ slug: (await c.getAttribute("data-slug"))!, origem: (await capa.getAttribute("data-origem"))!, src: await capa.locator("img").first().getAttribute("src").catch(() => null) });
    }
    for (const a of amostra) {
      expect(a.origem, `${a.slug}: o cartão nunca fica sem capa`).not.toBe("nenhuma");
      await page.goto(`/parceiros/${a.slug}`, { waitUntil: "domcontentloaded" });
      const capa = page.getByTestId("parceiro-capa");
      await expect(capa).toBeVisible({ timeout: 30_000 });
      expect(await capa.getAttribute("data-origem"), `${a.slug}: mesma origem da capa no cartão e na página`).toBe(a.origem);
      if (a.origem === "capa" || a.origem === "galeria" || a.origem === "foto") {
        expect(await page.getByTestId("parceiro-banner").getAttribute("src"), `${a.slug}: mesma imagem`).toBe(a.src);
      }
      if (a.origem === "galeria") {
        const primeira = await page.getByTestId("parceiro-galeria-secao").locator("img").first().getAttribute("src");
        expect(primeira, `${a.slug}: a capa de galeria é a 1ª foto da galeria`).toBe(a.src);
      }
    }
  });
});
