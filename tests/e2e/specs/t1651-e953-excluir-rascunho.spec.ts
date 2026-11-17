import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1651 — E953 (Daniel, 15/11): excluir rascunho em "Meus imóveis" volta a funcionar, com confirmação e retorno visíveis.
  Só com uma conta de proprietário do laboratório e rascunhos criados pelo próprio spec. 390 e 1280 px:
    1. a lixeira abre a confirmação como painel no cartão, dentro da tela e legível (largura do cartão, não a do botão);
    2. "Cancelar" (e Esc) mantém o cartão;
    3. erro simulado (a ação do servidor forçada a falhar no lab) → a mensagem aparece DENTRO do cartão e o cartão fica;
    4. "Excluir" tira o cartão sem recarregar e mostra "Rascunho excluído"; recarregar confirma que sumiu;
    5. o cartão publicado não tem lixeira.
  Prints rotulados "preview" em tests/laboratorio/saida/.
  Só @E953: login e massa pela chave de serviço do laboratório — a trava do @ao-vivo-seguro (E951) não deixa (ver o PR).
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T1651 — E953: excluir rascunho em Meus imóveis", { tag: ["@E953"] }, () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (conta e rascunhos criados pelo spec).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t1651.${sufixo}@lab.vivanomads.test`, nome: "Elisa Exclusão", role: "owner" as const };
  const ids: { dono?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Publicado E953 ${sufixo}`, { ativo: true, preco: 2600 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  async function abrir(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    return p;
  }
  const cartao = (p: Page, titulo: string) => p.getByTestId("meu-anuncio").filter({ hasText: titulo });

  for (const w of [390, 1280]) {
    test(`a ${w} px: confirmação legível, cancelar, erro no cartão, excluir sem recarregar; publicado sem lixeira`, async ({ browser }) => {
      const titulo = `Rascunho E953 ${w} ${sufixo}`;
      await criarImovelPronto(ids.dono!, titulo);
      const p = await abrir(browser, w);
      const c = cartao(p, titulo);
      await expect(c).toHaveCount(1, { timeout: 30_000 });
      await p.evaluate(() => ((window as unknown as { __semRecarregar: number }).__semRecarregar = 1));

      // 1. A lixeira abre a confirmação: painel no cartão, visível, dentro da tela, na largura do cartão.
      const lixeira = c.getByRole("button", { name: new RegExp(`^Excluir o rascunho “${titulo}”`) });
      await lixeira.click();
      const painel = c.getByTestId("excluir-rascunho-confirmacao");
      await expect(painel).toBeVisible();
      await expect(painel).toContainText(`Excluir o rascunho “${titulo}”`);
      await expect(painel).toContainText("Esta ação não pode ser desfeita.");
      await expect(painel).toBeFocused();
      const caixa = (await painel.boundingBox())!;
      const caixaCartao = (await c.boundingBox())!;
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(w + 1);
      expect(caixa.width, "na largura do cartão, não espremida na coluna do botão").toBeGreaterThan(caixaCartao.width * 0.7);
      await expect(painel.getByTestId("excluir-rascunho-confirmar")).toHaveText("Excluir");
      await expect(painel.getByTestId("excluir-rascunho-cancelar")).toHaveText("Cancelar");
      await painel.screenshot({ path: `${SAIDA}/t1651-preview-confirmacao-${w}.png` });

      // 2. Cancelar (e Esc) mantém o cartão.
      await painel.getByTestId("excluir-rascunho-cancelar").click();
      await expect(painel).toHaveCount(0);
      await expect(c).toHaveCount(1);
      await lixeira.click();
      await expect(painel).toBeVisible();
      await p.keyboard.press("Escape");
      await expect(painel).toHaveCount(0);
      await expect(c).toHaveCount(1);

      // 3. Erro simulado: a ação do servidor falha (500) → mensagem DENTRO do cartão, junto da confirmação; o cartão fica.
      await p.route("**/dashboard/imoveis**", async (r) => {
        if (r.request().method() === "POST" && r.request().headers()["next-action"]) await r.fulfill({ status: 500, body: "erro simulado no laboratório" });
        else await r.continue();
      });
      await lixeira.click();
      await painel.getByTestId("excluir-rascunho-confirmar").click();
      const erro = c.getByTestId("excluir-rascunho-erro");
      await expect(erro).toBeVisible({ timeout: 15_000 });
      await expect(erro).toHaveAttribute("role", "alert");
      await expect(c).toHaveCount(1);
      await expect(p.getByTestId("imoveis-excluido")).toHaveCount(0);
      await c.screenshot({ path: `${SAIDA}/t1651-preview-erro-no-cartao-${w}.png` });
      await p.unroute("**/dashboard/imoveis**");

      // 4. Excluir de verdade: o cartão sai sem recarregar e aparece "Rascunho excluído".
      await painel.getByTestId("excluir-rascunho-confirmar").click();
      await expect(c).toHaveCount(0, { timeout: 15_000 });
      await expect(p.getByTestId("imoveis-excluido")).toHaveText("Rascunho excluído");
      await expect(p.getByTestId("imoveis-aviso-exclusao")).toHaveAttribute("aria-live", "polite");
      expect(await p.evaluate(() => (window as unknown as { __semRecarregar?: number }).__semRecarregar)).toBe(1);
      await p.getByTestId("imoveis-aviso-exclusao").screenshot({ path: `${SAIDA}/t1651-preview-excluido-${w}.png` });
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("meu-anuncio").first()).toBeVisible({ timeout: 30_000 });
      await expect(cartao(p, titulo)).toHaveCount(0);

      // 5. O cartão publicado não tem lixeira.
      const publicado = cartao(p, `Publicado E953 ${sufixo}`);
      await expect(publicado).toHaveCount(1);
      await expect(publicado.getByTestId("excluir-rascunho")).toHaveCount(0);
      await p.context().close();
    });
  }
});
