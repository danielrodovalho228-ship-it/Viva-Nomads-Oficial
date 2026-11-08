import { test, expect } from "@playwright/test";

/*
  T842 — E527 (D13, QA de cliques do morador 02/11): legenda do calendário do anúncio com amostras claramente distintas
  (Disponível verde × Indisponível cinza) iguais à cor dos dias, e sem risco sobre a palavra "Indisponível". 1280 e 390.
*/
for (const largura of [1280, 390] as const) {
  test.describe(`T842 — E527 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("legenda: amostras distintas, iguais aos dias, sem risco", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const legenda = page.getByTestId("calendario-legenda");
      await expect(legenda).toBeAttached({ timeout: 20_000 });
      const r = await page.evaluate(() => {
        const leg = document.querySelector('[data-testid="calendario-legenda"]')!;
        const item = (txt: string) => [...leg.children].find((s) => s.textContent!.trim() === txt)!;
        const cor = (e: Element | null) => (e ? getComputedStyle(e).backgroundColor : null);
        const risco = [...leg.querySelectorAll("*"), leg].some((e) => getComputedStyle(e).textDecorationLine.includes("line-through"));
        return {
          amostraDisp: cor(item("Disponível").firstElementChild),
          amostraIndisp: cor(item("Ocupado (já reservado)").firstElementChild),
          diaDisp: cor(document.querySelector('[data-estado-dia="disponivel"]')),
          diaIndisp: cor(document.querySelector('[data-estado-dia="indisponivel"][data-tipo-dia="ocupado"]')),
          risco,
        };
      });
      expect(r.risco, "nada riscado na legenda").toBe(false);
      expect(r.amostraDisp).not.toBe(r.amostraIndisp);
      // verde × cinza: no cinza os três canais são iguais; no verde, o G é maior que o R
      const rgb = (s: string) => s.match(/\d+/g)!.slice(0, 3).map(Number);
      const [ri, gi, bi] = rgb(r.amostraIndisp!);
      expect(ri === gi && gi === bi, `Indisponível em cinza (${r.amostraIndisp})`).toBe(true);
      const [rd, gd] = rgb(r.amostraDisp!);
      expect(gd > rd, `Disponível em verde (${r.amostraDisp})`).toBe(true);
      if (r.diaDisp) expect(r.diaDisp).toBe(r.amostraDisp);
      if (r.diaIndisp) expect(r.diaIndisp).toBe(r.amostraIndisp);
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
    });
  });
}
