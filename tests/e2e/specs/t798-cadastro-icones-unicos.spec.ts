import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T798 — conformidade do cadastro (Passo 5, 01/11, Pista A): um ícone por comodidade — nenhum cartão de comodidade
  repete o ícone de outro (antes 3 pares dividiam: trabalho, reunião/festas, lavar/lavanderia). 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: authFile("proprietario") });

for (const largura of [390, 1280] as const) {
  test(`T798 — Passo 5 com um ícone por comodidade (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/imoveis/novo?etapa=comodidades", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(page.locator("main")).toBeVisible();
    const repetidos = await page.evaluate(() => {
      const m = new Map<string, string[]>();
      for (const b of document.querySelectorAll("main button[role=checkbox], main button[aria-checked]")) {
        const svg = b.querySelector("svg");
        const t = (b as HTMLElement).innerText.trim().split("\n")[0];
        if (!svg || !t) continue;
        const k = svg.getAttribute("class") ?? "";
        m.set(k, [...(m.get(k) ?? []), t]);
      }
      return [...m.entries()].filter(([k, v]) => !k.includes("lucide-sparkles") && !k.includes("lucide-check") && v.length > 1).map(([, v]) => v);
    });
    expect(repetidos).toEqual([]);
    await page.screenshot({ path: `${SAIDA}/t798-passo5-${largura}.png`, fullPage: true });
  });
}
