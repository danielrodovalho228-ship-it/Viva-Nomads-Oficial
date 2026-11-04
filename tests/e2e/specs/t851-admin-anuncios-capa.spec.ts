import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T851 — Onda 5 (matriz admin-anuncios): na lista de anúncios do admin, cada linha tem a capa do anúncio (como no
  mockup) — a foto real, que carrega, ou o espaço "sem foto"; nenhuma foto do acervo. 390 e 1280, sessão de admin.
*/
test.describe("T851 — admin/imoveis: capa em cada anúncio", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (sessão de admin)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  test("cada linha com capa real carregada ou espaço sem foto (390 e 1280)", async ({ browser }) => {
    for (const largura of [1280, 390]) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      // Os anúncios de exemplo (tipo demonstração) têm foto real da demo: a lista nunca fica sem capa para conferir.
      await page.goto("/admin/imoveis?tipo=demonstracao", { waitUntil: "networkidle" });
      const linhas = page.getByTestId("imovel-linha");
      await expect(linhas.first()).toBeVisible({ timeout: 30_000 });
      const r = await page.evaluate(async () => {
        const ls = [...document.querySelectorAll('[data-testid="imovel-linha"]')].slice(0, 12);
        const imgs = ls.map((l) => l.querySelector('[data-testid="imovel-capa"]')).filter((c): c is HTMLImageElement => c instanceof HTMLImageElement);
        for (const i of imgs) i.scrollIntoView({ block: "center" });
        await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.addEventListener("load", ok, { once: true }); i.addEventListener("error", ok, { once: true }); setTimeout(ok, 10_000); }))));
        return {
          semCapa: ls.filter((l) => !l.querySelector('[data-testid="imovel-capa"]')).length,
          comFoto: imgs.length,
          quebradas: imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length,
          acervo: imgs.filter((i) => decodeURIComponent(i.currentSrc || i.src).includes("placeholder-imovel-")).length,
        };
      });
      expect(r.semCapa, `@${largura}: linha sem capa nem espaço sem foto`).toBe(0);
      expect(r.comFoto, `@${largura}: os exemplos têm foto real`).toBeGreaterThan(0);
      expect({ quebradas: r.quebradas, acervo: r.acervo }, `@${largura}`).toEqual({ quebradas: 0, acervo: 0 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await linhas.first().screenshot({ path: `tests/laboratorio/saida/t851-capa-${largura}.png` });
      await ctx.close();
    }
  });
});
