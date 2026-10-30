import { test, expect } from "@playwright/test";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T732 — conformidade visual da BUSCA (passada final, 30/10), a 1280 e 390:
   - a 390, "R$ 0 de taxa para você" fica numa linha própria, sem o "·" solto no começo da linha (antes, quebrava
     a linha começando pelo separador); a 1280, segue na linha da contagem com o "·";
   - a varredura do protocolo (seis classes) limpa.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T732 — conformidade da busca", () => {
  for (const largura of [1280, 390] as const) {
    test(`${largura} px: complemento da contagem sem separador solto; varredura limpa`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      const respostas = escutarImagens(p);
      await p.goto("/buscar", { waitUntil: "domcontentloaded" });
      const complemento = p.getByTestId("complemento-busca");
      await expect(complemento).toBeVisible({ timeout: 30_000 });
      const texto = (await complemento.innerText()).trim();
      const h1 = (await p.getByTestId("titulo-busca").boundingBox())!;
      const c = (await complemento.boundingBox())!;
      if (largura === 390) {
        expect(texto, "no celular, sem o separador").toBe("R$ 0 de taxa para você");
        expect(c.y, "na linha de baixo da contagem").toBeGreaterThan(h1.y + h1.height - 2);
        expect(Math.round(c.x)).toBe(Math.round(h1.x));
      } else {
        expect(texto).toBe("· R$ 0 de taxa para você");
        expect(Math.abs(c.y + c.height / 2 - (h1.y + h1.height / 2)), "na linha da contagem").toBeLessThanOrEqual(12);
      }
      await p.screenshot({ path: `${SAIDA}/t732-busca-${largura}.png` });
      await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const achados = await varrerPagina(p, respostas);
      for (const k of Object.keys(CLASSES) as Classe[]) expect.soft(achados[k], `busca ${largura} — ${CLASSES[k]}`).toEqual([]);
      await ctx.close();
    });
  }
});
