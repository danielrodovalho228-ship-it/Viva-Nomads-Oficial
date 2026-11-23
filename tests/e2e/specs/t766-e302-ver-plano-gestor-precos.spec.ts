import { test, expect } from "@playwright/test";
import { TEXTO_CARTEIRAS } from "../../../src/config/planos";
import { MOTIVO_PRECOS_SUSPENSA, PRECOS_SUSPENSA } from "../fixtures/precos";

/*
  T766 — E302 (resíduo de 01/11): em /precos havia, junto do "Falar sobre o Plano Gestor" (contato), a ação "Ver o Plano
  Gestor", que rolava até a seção #plano-gestor da própria página. A 390 e a 1280.
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor deixou de ser oferta pública — o link "Ver o
  Plano Gestor" e a seção #plano-gestor saíram; o botão de contato virou "Falar com a Viva sobre carteiras"; no lugar da
  seção há a das carteiras (#carteiras, `carteiras-secao`), e quem chega nela pelo clique é o "Ver as taxas" do cartão
  "Gestores e administradoras" de /parceiros (/precos#carteiras, src/lib/parceiros/tipos-parceria.ts).
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  // 078 (Daniel, 16/11/2026): o título era `"Ver o Plano Gestor" em /precos rola até a seção`.
  test(`T766 — E302/078: /precos sem "Ver o Plano Gestor"; o "Ver as taxas" de /parceiros leva à seção das carteiras (${largura} px)`, async ({ page }) => {
    test.skip(PRECOS_SUSPENSA, MOTIVO_PRECOS_SUSPENSA);
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/precos", { waitUntil: "domcontentloaded" });
    const botoes = page.getByTestId("precos-botoes");
    // 078 (Daniel, 16/11/2026): o botão de contato era "Falar sobre o Plano Gestor".
    await expect(botoes.getByTestId("plano-gestor-botao")).toHaveText("Falar com a Viva sobre carteiras");
    // 078 (Daniel, 16/11/2026): o link "Ver o Plano Gestor" (href #plano-gestor) e a seção dele eram cobrados como
    // presentes; agora são cobrados como ausentes.
    await expect(page.getByTestId("precos-ver-plano-gestor")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Plano Gestor/i })).toHaveCount(0);
    await expect(page.locator('a[href$="#plano-gestor"]')).toHaveCount(0);
    await expect(page.locator("#plano-gestor")).toHaveCount(0);
    await expect(page.getByTestId("plano-gestor-secao")).toHaveCount(0);

    // 078 (Daniel, 16/11/2026): o clique que leva à seção agora sai de /parceiros ("Ver as taxas" → /precos#carteiras);
    // antes era o "Ver o Plano Gestor" da própria /precos (→ #plano-gestor).
    await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
    const ver = page.getByTestId("parceiros-tipos").getByRole("link", { name: "Ver as taxas", exact: true });
    await expect(ver).toHaveAttribute("href", "/precos#carteiras");
    await ver.scrollIntoViewIfNeeded();
    await ver.click();
    await expect(page).toHaveURL(/\/precos#carteiras$/, { timeout: 30_000 });
    const secao = page.getByTestId("carteiras-secao");
    await expect(secao).toHaveAttribute("id", "carteiras");
    await expect(secao).toBeInViewport();
    // 078 (Daniel, 16/11/2026): a seção trazia "Plano Gestor"; agora traz o título e a linha das carteiras, sem o Gestor.
    await expect(secao.getByRole("heading", { level: 3 })).toHaveText("Carteiras e administradoras");
    await expect(page.getByTestId("carteiras-texto")).toHaveText(TEXTO_CARTEIRAS);
    await expect(secao).not.toContainText(/Plano Gestor/i);
    await page.screenshot({ path: `${SAIDA}/t766-precos-carteiras-${largura}.png` });
  });
}
