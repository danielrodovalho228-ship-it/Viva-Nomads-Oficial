import { test, expect } from "@playwright/test";

/*
  T1615 — E753 (Phoenix RELATORIO-004 C2, reconfirmado no RELATORIO-013, 12/11): no mesmo anúncio, "Internet fibra 200 Mbps"
  nas comodidades × "Internet 100 Mbps" no Espaço de trabalho (ube-002). Regra: uma velocidade só por anúncio, e a
  velocidade só declarada nunca aparece como fato — toda menção vem rotulada: "informada pelo proprietário … (não medida)"
  / "N Mbps informados" (o mesmo campo único), ou "medida no imóvel", com medição válida.
  Página pública dos 15 anúncios de exemplo; não precisa de conta.
*/
const IDS = Array.from({ length: 15 }, (_, i) => `ube-${String(i + 1).padStart(3, "0")}`);

test.describe("T1615 — E753 uma velocidade só por anúncio, nunca afirmada como medida", () => {
  for (const id of IDS) {
    test(`${id}: toda velocidade rotulada (declarada ou medida); um número só`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const resp = await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      test.skip(!resp || resp.status() === 404, `${id} não existe nesta base`);
      await expect(page.locator("main")).toContainText(/Espaço de trabalho|Comodidades|O que tem/i, { timeout: 30_000 });
      const r = await page.evaluate(() => {
        const main = document.querySelector("main")!;
        const linha = main.querySelector('[data-testid="internet-imovel"]');
        const textoLinha = linha?.textContent ?? "";
        const copia = main.cloneNode(true) as HTMLElement;
        copia.querySelectorAll('[data-testid="internet-imovel"]').forEach((e) => e.remove());
        const fora = [...(copia.textContent ?? "").matchAll(/(\d{2,4})\s*Mbps(\s*informad\w*)?/gi)];
        // Fora da linha de internet, só vale a velocidade dita como DECLARADA ("N Mbps informados", do mesmo campo).
        const soltos = fora.filter((m) => !m[2]).map((m) => m[0]);
        const naLinha = [...textoLinha.matchAll(/(\d{2,4})\s*Mbps/gi)].map((m) => m[1]);
        const numeros = [...new Set([...fora.map((m) => m[1]), ...naLinha])];
        return { soltos, naLinha, numeros, textoLinha };
      });
      expect(r.soltos, `velocidade afirmada sem rótulo (como fato/medida): ${JSON.stringify(r.soltos)}`).toEqual([]);
      expect(r.numeros.length, `mais de uma velocidade no mesmo anúncio: ${JSON.stringify(r.numeros)}`).toBeLessThanOrEqual(1);
      if (r.naLinha.length) expect(r.textoLinha).toMatch(/\(não medida\)|medida no imóvel/);
    });
  }
});
