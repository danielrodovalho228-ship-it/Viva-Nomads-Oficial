import { test, expect } from "@playwright/test";
import { ROTAS_AXE_PUBLICAS } from "../../../src/lib/lab/axe-regras";
import { alvoDoControle, descreverAlvos, temRolagemLateral, type AlvoMedido } from "../../../src/lib/lab/alvos-toque";

/*
  T259 — 390 e 1280 px nas páginas públicas (ordem 21708cca, parte D): sem rolagem lateral e, no celular, botões e
  campos visíveis com pelo menos 44 px de altura. Cada página gera um print em tests/laboratorio/saida.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280]) {
  test.describe(`largura ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    for (const rota of ROTAS_AXE_PUBLICAS) {
      test(`${rota}: sem rolagem lateral${largura === 390 ? " e com alvos de toque de 44 px" : ""}`, async ({ page }, info) => {
        test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
        await page.goto(rota, { waitUntil: "networkidle" });
        const nome = rota === "/" ? "home" : rota.replace(/\W+/g, "-").replace(/^-|-$/g, "");
        await page.screenshot({ path: `${SAIDA}/t259-${nome}-${largura}.png`, fullPage: false });
        const medidas = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          janela: window.innerWidth,
          alvos: Array.from(document.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, [role=button]"))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              const e = getComputedStyle(el);
              return r.width > 0 && r.height > 0 && e.visibility !== "hidden" && e.display !== "none" && !el.closest("[aria-hidden=true]");
            })
            // Só medidas cruas aqui: esta função roda no navegador, onde o alvoDoControle importado não existe.
            .map((el) => {
              const caixa = el.getBoundingClientRect();
              const rotulo = el.closest("label")?.getBoundingClientRect();
              const id = el.id ? `#${el.id}` : el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : "";
              return {
                seletor: `${el.tagName.toLowerCase()}${id}`,
                tipo: el.getAttribute("type"),
                caixa: { largura: caixa.width, altura: caixa.height },
                rotulo: rotulo ? { largura: rotulo.width, altura: rotulo.height } : null,
              };
            }),
        }));
        expect(temRolagemLateral(medidas.scrollWidth, medidas.janela), `${rota} @${largura}: rolagem lateral`).toBe(false);
        if (largura === 390) {
          const alvos: AlvoMedido[] = medidas.alvos.map((a) => ({ seletor: a.seletor, ...alvoDoControle(a.tipo, a.caixa, a.rotulo) }));
          // L-65 (Pista A, #1313 E82): as pílulas da /buscar têm 40 px de altura; anotadas até a correção.
          const pilula = (a: AlvoMedido) => rota === "/buscar" && /data-testid=pilula-/.test(a.seletor);
          const pilulas = descreverAlvos(alvos.filter(pilula));
          if (pilulas) info.annotations.push({ type: "L-65", description: `/buscar @390: ${pilulas}` });
          expect(descreverAlvos(alvos.filter((a) => !pilula(a))), `${rota} @390: alvos menores que 44 px`).toBe("");
        }
      });
    }
  });
}
