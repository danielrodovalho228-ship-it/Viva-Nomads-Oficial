import { test, expect, type Page } from "@playwright/test";
import { GESTOR_DIFERENCIAIS, GESTOR_TEXTO } from "../../../src/config/planos";
import { PRECOS_SUSPENSA } from "../fixtures/precos";

/*
  T854 — E564 (parte A, decisão do Daniel, 04/11/2026): o Gestor é "4% para carteiras de 20 ou mais imóveis, com cadastro
  assistido da carteira e contato direto na Viva". Nenhum texto público diz "a partir de R$ 500/mês", "taxa (de serviço)
  zero" ou "taxa negociável", nem anuncia ferramenta da fase 2. 390 e 1280. /precos (suspensa pelo E563) só é conferida com
  a chave ligada.
*/
const ANTIGOS = /R\$ ?500\/m[eê]s|taxa (de serviço )?zero|taxa negoci[aá]vel|20 imóveis incluídos|R\$ ?25 por imóvel|condições negociadas/i;
const FASE2 = /vários proprietários|importação em massa|sincroniza|permissões de equipe/i;
const textoDe = async (page: Page, rota: string) => {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
};

for (const largura of [390, 1280] as const) {
  test.describe(`T854 — E564 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("/anunciar e /parceiros: o Gestor de 4% com cadastro assistido; nada do Gestor antigo nem da fase 2", async ({ page }) => {
      for (const rota of ["/para-proprietarios", "/parceiros"]) {
        const t = await textoDe(page, rota);
        expect(t, rota).toContain(`Plano Gestor: ${GESTOR_TEXTO}`);
        expect(t, rota).not.toMatch(ANTIGOS);
        expect(t, rota).not.toMatch(FASE2);
        expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura), rota).toBeLessThanOrEqual(1);
      }
      await page.goto("/para-proprietarios", { waitUntil: "domcontentloaded" });
      await page.getByText(`Plano Gestor: ${GESTOR_TEXTO}`).first().screenshot({ path: `tests/laboratorio/saida/t854-anunciar-${largura}.png` });
    });

    test("/precos (só com a chave do E563 ligada): seção do Gestor com os 4 diferenciais e a faixa 31+ em 6%", async ({ page }) => {
      test.skip(PRECOS_SUSPENSA, "E563: página de preços suspensa");
      const t = await textoDe(page, "/precos");
      expect(t).not.toMatch(ANTIGOS);
      const secao = page.getByTestId("plano-gestor-secao");
      await expect(secao.getByRole("heading", { name: "Plano Gestor" })).toBeVisible();
      await expect(page.getByTestId("plano-gestor-texto")).toHaveText(`${GESTOR_TEXTO}.`);
      await expect(page.getByTestId("plano-gestor-diferenciais").locator("li")).toHaveText([...GESTOR_DIFERENCIAIS]);
      const faixas = page.getByTestId(largura === 390 ? "faixas-taxa-cartoes" : "faixas-taxa");
      await expect(faixas).not.toContainText(/Negociado|negoci[aá]vel/i);
      await secao.screenshot({ path: `tests/laboratorio/saida/t854-precos-gestor-${largura}.png` });
    });
  });
}
