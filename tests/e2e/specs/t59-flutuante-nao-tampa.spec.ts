import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T59 — F49: o botão flutuante "Fale com a Viva" nunca tampa botão/campo (360/390 px).
 * Para cada botão principal visível (data-cta / submit) e cada campo, o elemento que recebe o
 * clique no centro é o próprio controle (elementFromPoint), e o flutuante é redondo (48 px).
 */
async function nadaTampa(page: Page) {
  const tampados = await page.evaluate(() => {
    const flut = document.querySelector('[data-testid="fale-com-a-viva-raiz"]');
    const alvos = Array.from(document.querySelectorAll<HTMLElement>("[data-cta], button[type=submit], input:not([type=hidden]), textarea, select"));
    const ruins: string[] = [];
    for (const el of alvos) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const topo = document.elementFromPoint(x, y);
      if (flut && topo && flut.contains(topo)) ruins.push((el.textContent || el.getAttribute("name") || el.tagName).trim().slice(0, 40));
    }
    return ruins;
  });
  expect(tampados, "controles tampados pelo botão flutuante").toEqual([]);
}

async function rolarAteOFim(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
}

for (const largura of [360, 390]) {
  test.describe(`T59 — flutuante não tampa (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 800 } });

    test("público: / e /ajuda e /buscar", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const flut = page.getByTestId("fale-com-a-viva");
      await expect(flut).toBeVisible();
      const caixa = await flut.boundingBox();
      expect(Math.round(caixa!.width)).toBe(48);
      await nadaTampa(page);
      await rolarAteOFim(page);
      await nadaTampa(page);
      for (const rota of ["/ajuda", "/buscar"]) {
        await page.goto(rota, { waitUntil: "networkidle" });
        await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
        await nadaTampa(page);
      }
    });

    test("campo em foco esconde o flutuante e ele volta ao sair", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const campo = page.locator("input:visible, textarea:visible").first();
      await campo.focus();
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toBeHidden();
      await campo.blur();
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toBeVisible();
    });

    test.describe("logado", () => {
      test.use({ storageState: authFile("inquilino") });
      test("/dashboard e Segurança", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "networkidle" });
        await nadaTampa(page);
        await rolarAteOFim(page);
        await nadaTampa(page);
        await page.goto("/dashboard/conta/seguranca", { waitUntil: "networkidle" });
        await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
        await nadaTampa(page);
      });
    });
  });
}
