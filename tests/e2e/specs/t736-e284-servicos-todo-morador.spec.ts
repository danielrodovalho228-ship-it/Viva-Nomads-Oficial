import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T736 — E284 (conferência do Muse contra a folha aprovada, Tela 1, 30/10), a 1280 e 390: a seção "Serviços" aparece
  na home de TODO morador. Antes, o morador sem cidade no perfil (sem estadia, como a conta da Ana) não via a seção — a
  home terminava em "Imóveis recomendados"/"Salve seus favoritos". Agora ela vem logo depois, com os 6 cartões com foto
  e a faixa "Como funciona"; sem cidade, cada cartão abre a busca de parceiros só com a categoria. Quem também é dono
  vê a seção UMA vez (a do bloco de proprietário).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t736.${sufixo}@lab.vivanomads.test`, nome: "Ana Semcidade", role: "tenant" as const };
const dono = { email: `dono.t736.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: { morador?: string; dono?: string } = {};

test.describe("T736 — E284: Serviços na home de todo morador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Studio t736 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: morador sem cidade e sem estadia vê os Serviços depois de "Salve seus favoritos"`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("painel-servicos-parceiros");
      await expect(painel).toHaveCount(1, { timeout: 30_000 });
      await painel.scrollIntoViewIfNeeded();
      await expect(painel).toBeVisible();
      // Na posição da folha: depois de "Salve seus favoritos".
      const favoritos = (await p.getByText("Salve seus favoritos").boundingBox())!;
      const servicos = (await painel.boundingBox())!;
      expect(servicos.y).toBeGreaterThan(favoritos.y);
      // Os 6 cartões com foto carregada e a faixa "Como funciona".
      const imgs = painel.getByTestId("servicos-foto").locator("img");
      await expect(imgs).toHaveCount(6);
      for (let i = 0; i < 6; i++) {
        await imgs.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      await expect(painel.getByTestId("servicos-passo")).toHaveCount(3);
      // Sem cidade no perfil: a busca abre só com a categoria.
      await expect(painel.getByTestId("servicos-limpeza")).toHaveAttribute("href", "/parceiros/buscar?categoria=limpeza");
      await painel.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t736-morador-${largura}.png`, fullPage: largura === 390 });
      await p.context().close();
    });
  }

  test("quem também é dono vê a seção uma vez só", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("painel-servicos-parceiros")).toHaveCount(1, { timeout: 30_000 });
    await p.context().close();
  });
});
