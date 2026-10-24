import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T376 — Prompt 62-A, Parte 1, item 1: em "Seja parceiro" (/parceiros), o convite "Avaliação de imóveis" explica que é
  credenciamento à parte (nunca categoria do catálogo) e leva aos passos do credenciamento. 390 e 1280, sem rolagem
  lateral, com print. (As telas do credenciamento, do dono, do avaliador e do admin entraram pelos #1133 e #1147 e têm
  as suas specs: t315, t341, t344.)
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}

test.describe("T376 — 62-A item 1: convite da avaliação em Seja parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  for (const w of [390, 1280]) {
    test(`a ${w} px: o convite aparece no formulário e leva ao credenciamento`, async ({ browser }) => {
      const pub = await (await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage();
      await pub.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const convite = pub.getByTestId("sp-convite-avaliacao");
      await expect(convite).toContainText("Avaliação de imóveis", { timeout: 20_000 });
      await expect(convite).toContainText("Credenciamento à parte");
      await expect(convite.getByRole("link", { name: "Ver os passos do credenciamento" })).toHaveAttribute("href", "/dashboard/parceiro/avaliacao");
      await convite.scrollIntoViewIfNeeded();
      await semRolagemLateral(pub);
      await convite.screenshot({ path: `${SAIDA}/t376-convite-${w}.png` });
      await pub.context().close();
    });
  }
});
