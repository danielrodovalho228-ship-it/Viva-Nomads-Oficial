import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T773 — E337 (01/11): Admin → Funil não mistura janelas sem dizer. Sem período na URL, as duas seções usam 7 dias;
  com 30 dias, a seção dos indicadores diz a própria janela e avisa que é diferente da do funil da semana. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test.describe("T773 — E337: janelas do Funil", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin em duas etapas).");
  test.describe.configure({ timeout: 150_000 });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: padrão 7 dias nas duas seções; 30 dias avisa a janela diferente`, async ({ browser }) => {
      const page = await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage();
      await page.goto("/admin/funil", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("funil-semana-janela")).toHaveText(/^Últimos 7 dias \(até \d{2}\/\d{2}\/\d{4}\) contra os 7 anteriores$/, { timeout: 30_000 });
      const ind = page.getByTestId("funil-indicadores");
      await expect(ind).toHaveAttribute("data-janela", "7");
      await expect(page.getByTestId("funil-indicadores-janela")).toHaveText(/^Últimos 7 dias: \d{2}\/\d{2} a \d{2}\/\d{2}\/\d{4}$/);
      await expect(page.getByTestId("funil-indicadores-janela-nota")).toHaveText("Mesma janela do funil da semana.");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t773-funil-7-${w}.png`, fullPage: true });

      await page.goto("/admin/funil?periodo=30", { waitUntil: "domcontentloaded" });
      await expect(ind).toHaveAttribute("data-janela", "30", { timeout: 30_000 });
      await expect(page.getByTestId("funil-indicadores-janela")).toHaveText(/^Últimos 30 dias: /);
      await expect(page.getByTestId("funil-indicadores-janela-nota")).toHaveText(
        "Janela diferente do funil da semana acima: não compare os números das duas seções.",
      );
      await page.getByTestId("funil-indicadores-janela").scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t773-funil-30-${w}.png` });
      await page.context().close();
    });
  }
});
