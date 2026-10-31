import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T746 — E246 (vigia, 31/10), guarda permanente: o botão flutuante "Fale com a Viva" nunca senta sobre texto ou
  cartão no celular. A 390 px ele não aparece em tela nenhuma — no topo, no meio e no fim da rolagem — e o "Fale com
  a Viva" segue no menu ☰ do topo público. A 1280 px ele continua (o desktop não muda) e não cobre botão nenhum.
*/
const SAIDA = "tests/laboratorio/saida";
const PUBLICAS = ["/", "/precos", "/como-funciona", "/para-proprietarios", "/parceiros", "/parceiros/fotografos", "/imoveis/ube-001"];
const PAINEL_DONO = ["/dashboard", "/dashboard/contratos", "/dashboard/imoveis"];
const PAINEL_MORADOR = ["/dashboard", "/dashboard/locacoes"];

async function semFlutuanteAoRolar(p: Page, rota: string) {
  await p.goto(rota, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const altura = await p.evaluate(() => document.documentElement.scrollHeight);
  for (const y of [0, altura / 2, altura]) {
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(150);
    await expect(p.getByTestId("fale-com-a-viva"), `${rota} rolado a ${Math.round(y)}`).toBeHidden();
  }
}

test.describe("T746 — E246: sem flutuante no celular; desktop intacto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.describe("390 px — visitante", () => {
    test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    test("páginas públicas: nada flutua sobre o conteúdo; o Fale com a Viva fica no menu ☰", async ({ page }) => {
      for (const rota of PUBLICAS) await semFlutuanteAoRolar(page, rota);
      await page.goto("/parceiros/fotografos", { waitUntil: "domcontentloaded" });
      await page.screenshot({ path: `${SAIDA}/t746-fotografos-390.png` });
      await page.getByTestId("nav-menu").click();
      await expect(page.getByTestId("nav-menu-lista").getByRole("link", { name: "Fale com a Viva" })).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
    });
  });

  test.describe("390 px — dono", () => {
    test.use({ viewport: { width: 390, height: 844 }, storageState: authFile("proprietario") });
    test("painel: Início, Contratos e Anúncios sem flutuante", async ({ page }) => {
      for (const rota of PAINEL_DONO) await semFlutuanteAoRolar(page, rota);
      await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await page.screenshot({ path: `${SAIDA}/t746-contratos-390.png` });
    });
  });

  test.describe("390 px — morador", () => {
    test.use({ viewport: { width: 390, height: 844 }, storageState: authFile("inquilino") });
    test("painel: Início e Estadias sem flutuante", async ({ page }) => {
      for (const rota of PAINEL_MORADOR) await semFlutuanteAoRolar(page, rota);
    });
  });

  test.describe("1280 px — visitante", () => {
    test.use({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    test("o flutuante continua e não cobre botão nenhum", async ({ page }) => {
      for (const rota of ["/", "/precos", "/parceiros/fotografos"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        const flut = page.getByTestId("fale-com-a-viva");
        await expect(flut, rota).toBeVisible();
        await expect(flut).toHaveText("Fale com a Viva");
        const tampados = await page.evaluate(() => {
          const raiz = document.querySelector('[data-testid="fale-com-a-viva-raiz"]');
          return Array.from(document.querySelectorAll<HTMLElement>("[data-cta], a[href], button, input:not([type=hidden])"))
            .filter((el) => !raiz?.contains(el))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return false;
              const topo = document.elementFromPoint(Math.min(r.left + r.width / 2, innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
              return !!(raiz && topo && raiz.contains(topo));
            })
            .map((el) => (el.textContent ?? "").trim().slice(0, 40));
        });
        expect(tampados, `${rota}: controles tampados`).toEqual([]);
      }
      await page.screenshot({ path: `${SAIDA}/t746-fotografos-1280.png` });
    });
  });
});
