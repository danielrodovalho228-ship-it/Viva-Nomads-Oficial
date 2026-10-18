import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T198 — Fim das telas do painel no celular (390 px), rolado até o fim: o último botão fica ACIMA da barra de abas e
  do "Fale com a Viva" (o conteúdo tem folga = barra + área segura do iPhone). Prints de Conta, Meus imóveis e
  Mensagens. A mesma regra vale para todas as telas logadas no t183.
*/
const SAIDA = "tests/laboratorio/saida";
const ROTAS = [
  ["conta", "/dashboard/conta"],
  ["imoveis", "/dashboard/imoveis"],
  ["mensagens", "/dashboard/mensagens"],
] as const;

test.describe("T198 — fim das telas do painel a 390 px", () => {
  test.skip(!hasAccount("proprietario"), "conta de proprietário do laboratório não configurada");
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  for (const [nome, rota] of ROTAS) {
    test(`${nome}: último botão livre acima da barra de abas`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1:visible").first()).toBeVisible({ timeout: 20_000 });
      // Rola até o fim até a altura parar (blocos que carregam depois).
      await page.evaluate(async () => {
        let antes = -1;
        for (let i = 0, parada = 0; i < 40 && parada < 3; i++) {
          window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise((ok) => setTimeout(ok, 250));
          const h = document.documentElement.scrollHeight;
          parada = h === antes ? parada + 1 : 0;
          antes = h;
        }
      });
      const r = await page.evaluate(() => {
        const fixo = (el: Element) => {
          for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
          return false;
        };
        // Controles da tela (fora do cabeçalho, do menu e do que é fixo): o último da página é o que importa.
        const controles = Array.from(document.querySelectorAll("a[href], button, input, select, textarea")).filter((el) => {
          const b = el.getBoundingClientRect();
          if (el.closest("header, nav, aside, [data-testid='fale-com-a-viva-raiz']")) return false;
          return b.width > 0 && b.height > 0 && !fixo(el) && getComputedStyle(el).visibility !== "hidden";
        });
        const ultimo = controles.reduce<Element | null>((a, b) => (!a || b.getBoundingClientRect().bottom >= a.getBoundingClientRect().bottom ? b : a), null);
        // Topo do que fica fixo embaixo (barra de abas, "Fale com a Viva"): o menor "top" entre os fixos do rodapé.
        const fixosRodape = Array.from(document.querySelectorAll("body *")).filter((el) => {
          const s = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return s.position === "fixed" && b.height > 0 && b.width > 0 && b.bottom >= window.innerHeight - 2 && b.top > window.innerHeight / 2;
        });
        const topoFixos = Math.min(window.innerHeight, ...fixosRodape.map((el) => el.getBoundingClientRect().top));
        const b = ultimo?.getBoundingClientRect();
        return { nome: (ultimo?.textContent ?? "").trim().slice(0, 40), fundo: b ? Math.round(b.bottom) : null, topoFixos: Math.round(topoFixos) };
      });
      expect(r.fundo, `nenhum controle em ${rota}`).not.toBeNull();
      expect(r.fundo!, `último controle "${r.nome}" fica embaixo de algo fixo em ${rota}`).toBeLessThanOrEqual(r.topoFixos);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t198-fim-${nome}-390.png`, fullPage: false });
    });
  }
});
