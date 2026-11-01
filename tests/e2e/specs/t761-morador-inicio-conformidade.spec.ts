import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T761 — Conformidade morador-inicio (matriz, 31/10), Início SÓ do morador a 390 e 1280:
   1. "Peça na Viva" (mockup): Publicar pedido de moradia e Pedir um serviço, nenhum botão cheio a mais.
   2. "Imóveis recomendados para você" com o MESMO cartão com foto da busca, em grade par, e "Ver todos".
   3. "Salve seus favoritos" só para quem ainda não salvou nenhum (conta nova: aparece).
   4. Os 4 números de acesso rápido em linha (computador) ou 2×2 (celular).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t761.${sufixo}@lab.vivanomads.test`, nome: "Lia Inicio", role: "tenant" as const };
const dono = { email: `dono.t761.${sufixo}@lab.vivanomads.test`, nome: "Dino Dono", role: "owner" as const };
const ids: { morador?: string; dono?: string } = {};

test.describe("T761 — Início do morador conforme o mockup", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Studio t761 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const inicio = p.getByTestId("inicio-so-morador");
      await expect(inicio).toBeVisible({ timeout: 30_000 });

      const peca = inicio.getByTestId("inicio-morador-peca");
      await expect(peca).toContainText("Peça na Viva");
      await expect(peca.getByTestId("inicio-morador-pedido")).toHaveAttribute("href", "/pedidos/novo");
      await expect(peca.getByTestId("inicio-morador-servico")).toHaveAttribute("href", "/dashboard/servicos");

      const rec = inicio.getByTestId("inicio-recomendados");
      await expect(rec).toContainText("Imóveis recomendados para você");
      await expect(rec.getByTestId("inicio-recomendados-todos")).toHaveAttribute("href", "/buscar");
      const cartoes = rec.locator('a[href^="/imoveis/"]').filter({ has: p.locator("img") });
      await expect(cartoes.first()).toBeVisible({ timeout: 30_000 });

      // Grade par: em cada linha, nenhuma casa sobrando (2 colunas no celular, 4 no computador).
      const colunas = await rec.locator("div.grid").first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
      expect(colunas).toBe(largura === 390 ? 2 : 4);

      await expect(inicio.getByText("Salve seus favoritos")).toBeVisible();
      const kpis = await inicio.getByTestId("inicio-morador-kpis").evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
      expect(kpis).toBe(largura === 390 ? 2 : 4);

      await p.screenshot({ path: `${SAIDA}/t761-inicio-morador-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
