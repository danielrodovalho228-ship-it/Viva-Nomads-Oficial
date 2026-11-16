import { test, expect, type Page } from "@playwright/test";

/*
  T2044 — E254 (Pista 3, cobertura do mapa das 142; aprovado na ORDEM-DUET-073) @E254 @ao-vivo-seguro
  Regra (E254-A, regra única E756): na página pública do imóvel, a estadia mínima mostra o TOTAL do período com a conta
  aberta — N × (total por mês) + as limpezas únicas (preparação e de saída) — e o total é exatamente essa soma; o
  "por mês" da conta é o mesmo "Total por mês" do cartão; cada limpeza única que o anúncio cobra entra na conta, com o
  mesmo valor.
  Visitante, só leitura, sem conta e sem gravar nada: vale para qualquer anúncio (pega os 3 primeiros da /buscar).
*/
test.use({ storageState: { cookies: [], origins: [] } });

const reais = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

async function anuncios(p: Page): Promise<string[]> {
  await p.goto("/buscar", { waitUntil: "domcontentloaded" });
  await expect(p.locator('a[href^="/imoveis/"]').first()).toBeVisible({ timeout: 30_000 });
  const hrefs = await p.locator('a[href^="/imoveis/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!).filter((h) => /^\/imoveis\/[^/?#]+$/.test(h)));
  return [...new Set(hrefs)].slice(0, 3);
}

test.describe("T2044 — E254: estadia mínima = N × total por mês + limpezas únicas @E254 @ao-vivo-seguro", () => {
  test("nos 3 primeiros anúncios da busca, o total da estadia fecha com a conta e com o cartão", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const lista = await anuncios(page);
    expect(lista.length).toBeGreaterThan(0);
    for (const href of lista) {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      const conta = page.getByTestId("cartao-lateral-estadia-conta").first();
      await expect(conta, `${href}: conta da estadia`).toBeVisible({ timeout: 30_000 });
      const linhas = (await conta.innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
      const m = linhas[0].match(/^(\d+) × (R\$\s*[\d.,]+)/);
      expect(m, `${href}: 1ª linha "${linhas[0]}"`).not.toBeNull();
      const n = Number(m![1]);
      const porMes = reais(m![2]);
      const unicos = linhas.slice(1).map((l) => {
        const u = l.match(/^\+\s*(.+?)\s+(R\$\s*[\d.,]+)$/);
        expect(u, `${href}: parcela "${l}"`).not.toBeNull();
        return { rotulo: u![1].toLowerCase(), valor: reais(u![2]) };
      });
      // O "por mês" da conta é o "Total por mês" do cartão.
      expect(porMes, `${href}: por mês`).toBe(reais(await page.getByTestId("total-por-mes").first().innerText()));
      // O total mostrado é exatamente N × por mês + únicos.
      const total = reais((await page.getByTestId("cartao-lateral-estadia").first().innerText()).split(" em ")[0]);
      expect(total, `${href}: total`).toBe(Math.round((n * porMes + unicos.reduce((s, u) => s + u.valor, 0)) * 100) / 100);
      // Cada limpeza única cobrada (fora do total mensal) entra na conta com o mesmo valor.
      const fora = page.getByTestId("taxas-itemizadas");
      if (await fora.count()) {
        const t = await fora.first().innerText();
        for (const rotulo of ["Limpeza de preparação", "Limpeza de saída"]) {
          const v = t.match(new RegExp(`${rotulo}\\s*\\n?\\s*(R\\$\\s*[\\d.,]+)`));
          if (v && reais(v[1]) > 0) expect(unicos.find((u) => u.rotulo === rotulo.toLowerCase())?.valor, `${href}: ${rotulo} na conta`).toBe(reais(v[1]));
        }
      }
    }
  });
});
