import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T801 — conformidade do cadastro (Passo 9, mockup 09, 01/11, Pista A): a prévia do anúncio fecha com o resumo da
  disponibilidade ("Resumo: Disponível … · Mínimo N dias"); nos outros passos, não. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: authFile("proprietario") });

for (const largura of [390, 1280] as const) {
  test(`T801 — Passo 9: resumo da disponibilidade na prévia (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/imoveis/novo?etapa=disponibilidade", { waitUntil: "domcontentloaded" });
    const resumo = page.getByTestId("previa-resumo").first();
    await expect(resumo).toBeAttached({ timeout: 20_000 });
    await expect(resumo).toHaveText(/^Resumo: Disponível (agora|a partir de \d{2}\/\d{2})( · Mínimo \d+ dias)?$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t801-passo9-${largura}.png` });
    await page.goto("/dashboard/imoveis/novo?etapa=preco", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("previa-anuncio").first()).toBeAttached({ timeout: 20_000 });
    await expect(page.getByTestId("previa-resumo")).toHaveCount(0);
  });
}
