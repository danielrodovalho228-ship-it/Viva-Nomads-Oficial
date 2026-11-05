import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T1183 — E446 (#2691, 05/11): a grade de bairros da cidade e a página do bairro contam o MESMO conjunto da busca. Antes a
 * contagem por bairro tirava os exemplos da vitrine: em produção todos os bairros diziam "Sem imóveis no momento"
 * enquanto a busca e a própria página mostravam imóveis. O E446 entrou só com teste de unidade; aqui é a tela, como
 * visitante, 390 e 1280, em /cidades/uberlandia:
 *   1. para até 3 bairros da grade com imóvel, o número do cartão é o mesmo do resumo da página do bairro;
 *   2. a página do bairro com imóvel não cai no vazio (bairro-vazio);
 *   3. sem estouro horizontal.
 * Outros specs criam anúncios em Uberlândia em paralelo: cada comparação relê os dois lados, com nova tentativa.
 */
const totalDoCartao = (texto: string) => {
  const m = texto.match(/(\d+)\s+imóve(?:l|is)/);
  return m ? Number(m[1]) : 0;
};

async function bairrosComImovel(page: Page): Promise<{ href: string; nome: string; total: number }[]> {
  await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("bairros-grade")).toBeVisible({ timeout: 30_000 });
  const cartoes = await page.getByTestId("bairro-cartao").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href") ?? "", texto: a.textContent ?? "" })));
  return cartoes.map((c) => ({ href: c.href, nome: c.href.split("/").pop() ?? "", total: totalDoCartao(c.texto) })).filter((c) => c.total > 0);
}

test.describe("T1183 — E446: a grade de bairros e a página do bairro contam o mesmo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [390, 1280] as const) {
    test(`o número do cartão do bairro é o do resumo da página (${w})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const iniciais = await bairrosComImovel(page);
      test.skip(iniciais.length === 0, "nenhum bairro com imóvel na grade desta base");
      for (const b of iniciais.slice(0, 3)) {
        await expect(async () => {
          const naGrade = (await bairrosComImovel(page)).find((x) => x.href === b.href)?.total ?? 0;
          await page.goto(b.href, { waitUntil: "domcontentloaded" });
          const resumo = page.getByTestId("bairro-resumo");
          await expect(resumo).toBeVisible({ timeout: 20_000 });
          const naPagina = totalDoCartao((await resumo.innerText()).replace("imóveis mobiliados", "imóveis").replace("imóvel mobiliado", "imóvel"));
          expect(naPagina, `${b.nome}: página ${naPagina} × grade ${naGrade}`).toBe(naGrade);
          await expect(page.getByTestId("bairro-vazio")).toHaveCount(0);
        }).toPass({ timeout: 60_000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      }
    });
  }
});
