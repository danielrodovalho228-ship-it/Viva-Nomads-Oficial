import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1437 — E695 (#3276, na main): a mensagem da busca sem resultado fala do LUGAR certo.
    1. Lugar COM imóveis, mas o filtro (preço) exclui todos: "Há N imóvel(is) em <lugar>, mas nenhum para essa data e esses
       filtros." — nunca "Ainda não temos imóvel…" e sem o convite de cidade.
    2. Lugar SEM nenhum imóvel: "Ainda não temos imóvel para essa busca em <lugar>." (a afirmação sobre o lugar só vale com zero).
  Visitante, 390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const dono = { email: `dono.t1437.${novoSufixo()}@lab.vivanomads.test`, nome: "Cida Busca", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T1437 — E695: busca vazia fala do lugar certo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, "Studio da busca vazia", { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: filtro que exclui tudo ≠ cidade sem imóveis`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      await page.goto("/buscar?local=Uberl%C3%A2ndia&preco=300", { waitUntil: "domcontentloaded" });
      const titulo = page.getByTestId("busca-vazia-titulo");
      await expect(titulo).toBeVisible({ timeout: 40_000 });
      await expect(titulo).toHaveText(/^Há \d+ imóve(l|is) em Uberlândia, mas nenhum para essa data e esses filtros\.$/);
      await expect(titulo).not.toContainText("Ainda não");
      await expect(page.getByTestId("busca-vazia-proxima")).toContainText(/Mude a data de entrada ou tire algum filtro/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      // T-E695 (QA, 07/11): outro filtro que exclui tudo num lugar COM imóveis dá a mesma mensagem de data/filtro, sem o convite de cidade.
      await page.goto("/buscar?local=Uberl%C3%A2ndia&quartos=9", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("busca-vazia-titulo")).toHaveText(/^Há \d+ imóve(l|is) em Uberlândia, mas nenhum para essa data e esses filtros\.$/, { timeout: 40_000 });

      await page.goto("/buscar?local=Cidade%20Sem%20Nenhum%20Imovel", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("busca-vazia-titulo")).toHaveText(/^Ainda não temos imóvel para essa busca em Cidade Sem Nenhum Imovel\.$/, { timeout: 40_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
