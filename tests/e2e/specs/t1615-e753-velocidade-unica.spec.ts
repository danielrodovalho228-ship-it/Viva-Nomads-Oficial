import { test, expect } from "@playwright/test";

/*
  T1615 — E753 (Phoenix RELATORIO-004 C2, reconfirmado no RELATORIO-013, 12/11): no mesmo anúncio, "Internet fibra 200 Mbps"
  nas comodidades × "Internet 100 Mbps" no Espaço de trabalho (ube-002). Regra: uma velocidade só por anúncio, e a
  velocidade só declarada nunca aparece como fato — só na linha de internet, rotulada "informada pelo proprietário …
  (não medida)" (ou "medida no imóvel", com medição válida).
  Página pública dos 15 anúncios de exemplo; não precisa de conta.
*/
const IDS = Array.from({ length: 15 }, (_, i) => `ube-${String(i + 1).padStart(3, "0")}`);

test.describe("T1615 — E753 uma velocidade só por anúncio, nunca afirmada como medida", () => {
  for (const id of IDS) {
    test(`${id}: velocidade só na linha de internet, rotulada; um número só`, async ({ page }) => {
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
        const soltos = [...(copia.textContent ?? "").matchAll(/(\d{2,4})\s*Mbps/gi)].map((m) => m[0]);
        const naLinha = [...textoLinha.matchAll(/(\d{2,4})\s*Mbps/gi)].map((m) => m[1]);
        return { soltos, naLinha, textoLinha };
      });
      expect(r.soltos, `velocidade solta fora da linha de internet: ${JSON.stringify(r.soltos)}`).toEqual([]);
      expect(new Set(r.naLinha).size, `mais de uma velocidade na linha: ${r.textoLinha}`).toBeLessThanOrEqual(1);
      if (r.naLinha.length) expect(r.textoLinha).toMatch(/\(não medida\)|medida no imóvel/);
    });
  }
});
