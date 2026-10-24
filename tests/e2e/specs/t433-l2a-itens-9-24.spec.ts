import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T433 — L2-A, itens 9 e 24. 390 e 1280, com prints.
 *   9. Editar um anúncio PUBLICADO: "Anúncio publicado" e nunca "Falta para publicar".
 *  24. O campo do preço é "Valor mensal (sem condomínio e contas)" e, embaixo, "No anúncio: R$ X/mês tudo incluído" (aluguel
 *      2.800 + condomínio 450 = R$ 3.250), mudando na hora com o valor — na edição e no passo Preço do cadastro.
 */
const SAIDA = "tests/laboratorio/saida";

test.describe("T433 — L2-A: publicado sem 'Falta para publicar'; valor mensal e o total do anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t433.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  const ids: { dono?: string; ativo?: string; rascunho?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ativo = await criarImovelPronto(ids.dono, `Apartamento total ${sufixo}`, { ativo: true, preco: 2800 });
    await adm().from("properties").update({ condo_fee: 450, utilities_mode: "real" }).eq("id", ids.ativo);
    ids.rascunho = await criarImovelPronto(ids.dono, `Studio total ${sufixo}`, { preco: 2800 });
    const { data } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho).single();
    await adm()
      .from("properties")
      .update({ draft_data: { ...((data?.draft_data as Record<string, unknown>) ?? {}), monthlyPrice: "2800", condoFee: "450", utilitiesMode: "real" } })
      .eq("id", ids.rascunho);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  async function abrir(browser: Browser, w: number, rota: string): Promise<Page> {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(rota, { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }

  for (const w of [390, 1280]) {
    test(`a ${w} px: edição do publicado (item 9) e o total do anúncio (item 24)`, async ({ browser }) => {
      const p = await abrir(browser, w, `/dashboard/imoveis/${ids.ativo}/editar`);
      await expect(p.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 30_000 });
      await expect(p.locator("main")).not.toContainText(/falta para publicar/i);
      // Item 24 na edição: o rótulo do aluguel e a linha do anúncio, que muda com o aluguel.
      const campo = p.getByLabel("Valor mensal (sem condomínio e contas)");
      await campo.scrollIntoViewIfNeeded().catch(() => {});
      if (!(await campo.isVisible())) await p.getByRole("button", { name: /Detalhes & preço/ }).click();
      await expect(campo).toBeVisible();
      const linha = p.getByTestId("editar-tudo-incluido");
      await expect(linha).toHaveText(/No anúncio: R\$\s?3\.250\/mês tudo incluído/);
      await campo.fill("3000");
      await expect(linha).toHaveText(/No anúncio: R\$\s?3\.450\/mês tudo incluído/);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t433-editar-${w}.png` });
      await p.context().close();

      // Item 24 no cadastro, passo Preço.
      const q = await abrir(browser, w, `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=preco`);
      await q.getByTestId("etapa-preco").waitFor({ timeout: 30_000 });
      await expect(q.getByText("Valor mensal (sem condomínio e contas)")).toBeVisible();
      const linhaCad = q.getByTestId("cadastro-tudo-incluido");
      await expect(linhaCad).toHaveText(/No anúncio: R\$\s?3\.250\/mês tudo incluído/);
      expect(await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await linhaCad.scrollIntoViewIfNeeded();
      await q.screenshot({ path: `${SAIDA}/t433-cadastro-preco-${w}.png` });
      await q.context().close();
    });
  }
});
